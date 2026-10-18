"""Local-only event prototype. Optional Resend test delivery; no real payments."""
import json, sqlite3, uuid, os
from decimal import InvalidOperation
from datetime import datetime, timedelta, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from mailer import load_config, send_preview
import workflows
from practitioners import get_practitioners, selected_hosts
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parent
DB = Path(os.environ.get('CG_EVENTS_DB', str(ROOT / 'demo.sqlite3')))
def connect():
    db = sqlite3.connect(DB, timeout=10)
    db.row_factory = sqlite3.Row
    return db

def setup():
    with connect() as db:
        db.executescript('''CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,title TEXT,description TEXT,starts TEXT,zone TEXT,location TEXT,hosts TEXT,capacity INTEGER,price INTEGER,published INTEGER);
CREATE TABLE IF NOT EXISTS bookings(id TEXT PRIMARY KEY,event_id TEXT,name TEXT,email TEXT,status TEXT,created TEXT);
CREATE TABLE IF NOT EXISTS emails(id TEXT PRIMARY KEY,recipient TEXT,subject TEXT,body TEXT);''')
        email_columns={r[1] for r in db.execute('PRAGMA table_info(emails)')}
        if 'sent_id' not in email_columns:db.execute("ALTER TABLE emails ADD COLUMN sent_id TEXT NOT NULL DEFAULT ''")
        columns={r[1] for r in db.execute('PRAGMA table_info(events)')}
        for column in ['ends','cover']:
            if column not in columns:db.execute(f"ALTER TABLE events ADD COLUMN {column} TEXT NOT NULL DEFAULT ''")
        workflows.migrate(db)
        if not db.execute('SELECT 1 FROM events').fetchone():
            start = (datetime.now()+timedelta(days=7)).strftime('%Y-%m-%dT19:00')
            db.execute('INSERT INTO events(id,title,description,starts,zone,location,hosts,capacity,price,published) VALUES(?,?,?,?,?,?,?,?,?,?)',('demo','An evening of inquiry','A shared space to pause, listen, and explore together.\n\nWe begin with a short meditation, followed by inquiry in pairs and time to reflect.',start,'Europe/Zurich','Online · Zoom link shared by your host','Nico, Irene',12,1500,1))

def email(db, recipient, subject, body):
    db.execute('INSERT INTO emails(id,recipient,subject,body) VALUES(?,?,?,?)',(str(uuid.uuid4()),recipient,subject,body))

def expire(db):
    cutoff=(datetime.now(timezone.utc)-timedelta(minutes=10)).isoformat()
    db.execute("UPDATE bookings SET status='expired' WHERE status='pending' AND created < ?",(cutoff,))

class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*a,**kw): super().__init__(*a,directory=str(ROOT),**kw)
    def reply(self,code,value):
        raw=json.dumps(value).encode();self.send_response(code)
        self.send_header('Content-Type','application/json');self.send_header('Cache-Control','no-store');self.end_headers();self.wfile.write(raw)
    def do_GET(self):
        if self.path=='/api/practitioners':
            try:self.reply(200,{'practitioners':get_practitioners()})
            except ValueError as e:self.reply(503,{'error':str(e)})
        elif self.path.startswith('/api/calendar?'):
            with connect() as db:
                event=db.execute('SELECT * FROM events WHERE id=?',(parse_qs(urlparse(self.path).query).get('id',[''])[0],)).fetchone()
                if not event:return self.send_error(404)
                raw=workflows.calendar(event).encode()
                self.send_response(200);self.send_header('Content-Type','text/calendar; charset=utf-8');self.send_header('Content-Disposition','attachment; filename=event.ics');self.end_headers();self.wfile.write(raw)
        elif self.path.split('?')[0] in ['/quill.js','/quill.snow.css','/journal-common.js']:
            files={'/quill.js':ROOT.parent/'vendor/quill/quill.js','/quill.snow.css':ROOT.parent/'vendor/quill/quill.snow.css','/journal-common.js':ROOT.parent/'js/journal-common.js'}
            key=self.path.split('?')[0];raw=files[key].read_bytes();self.send_response(200);self.send_header('Content-Type','text/css' if key.endswith('.css') else 'application/javascript');self.end_headers();self.wfile.write(raw)
        elif self.path=='/api/state':
            with connect() as db:
                expire(db)
                state={t:[dict(r) for r in db.execute('SELECT * FROM '+t)] for t in ['events','bookings','emails']}
                from zoneinfo import ZoneInfo
                for event in state['events']:
                    event['has_started']=datetime.fromisoformat(event['starts']).replace(tzinfo=ZoneInfo(event['zone']))<=datetime.now(timezone.utc)
                self.reply(200,state)
        elif self.path.split('?')[0] in ['/', '/index.html', '/app.js', '/advanced.js', '/event-settings.js', '/style.css']:
            super().do_GET()
        else: self.send_error(404)
    def do_POST(self):
        # Reject browser requests from other origins; this server binds only to loopback.
        origin=self.headers.get('Origin')
        if origin and origin != 'http://'+self.headers.get('Host',''):
            return self.reply(403,{'error':'Use the local prototype page.'})
        try:
            size=int(self.headers.get('Content-Length',0))
            if size>3000000: raise ValueError('Request too large.')
            p=json.loads(self.rfile.read(size))
            with connect() as db:
                db.execute('BEGIN IMMEDIATE');expire(db)
                result=self.action(db,self.path,p)
            self.reply(200,result)
        except (ValueError,KeyError,TypeError,InvalidOperation) as e:self.reply(400,{'error':str(e)})
        except Exception:self.reply(500,{'error':'Could not save. Please try again.'})
    def action(self,db,path,p):
        if path=='/api/send-preview':
            message=db.execute('SELECT * FROM emails WHERE id=?',(p.get('id'),)).fetchone()
            if not message:raise ValueError('Email preview not found.')
            if message['sent_id']:return {'sent':True}
            sent_id=send_preview(message)
            db.execute('UPDATE emails SET sent_id=? WHERE id=?',(sent_id,message['id']))
            return {'sent':True}
        if path in ['/api/guest-action','/api/duplicate','/api/cancel-event','/api/blast']:
            return workflows.action(db,path,p,email)
        if path=='/api/event':
            title=str(p['title']).strip();capacity=int(p['capacity']);price=round(float(p['price'])*100)
            if not title or len(title)>120 or not 1<=capacity<=10000 or not 0<=price<=1000000:raise ValueError('Check the title, capacity and price.')
            start=datetime.fromisoformat(p['starts'])
            ends=p.get('ends','')
            if ends and datetime.fromisoformat(ends)<=start:raise ValueError('End time must be after the start.')
            cover=p.get('cover','')
            if cover:
                import base64
                prefix,encoded=cover.split(',',1)
                if prefix not in ['data:image/jpeg;base64','data:image/png;base64','data:image/webp;base64'] or len(base64.b64decode(encoded,validate=True))>2097152:raise ValueError('Choose a JPEG, PNG or WebP image up to 2 MB.')
            from zoneinfo import ZoneInfo
            try: ZoneInfo(p['zone'])
            except Exception: raise ValueError('Use a valid timezone, such as Europe/Zurich.')
            html=str(p.get('description_html',''))
            if len(html)>30000:raise ValueError('Description formatting is too long.')
            host_ids=p.get('host_ids')
            hosts=selected_hosts(host_ids) if host_ids is not None else str(p['hosts'])[:500]
            location_type=p.get('location_type','in_person');location=str(p['location']).strip()
            if location_type not in ['online','in_person'] or not location or len(location)>2000:raise ValueError('Add an online meeting link or an in-person location.')
            if location_type=='online':
                link=urlparse(location)
                if link.scheme!='https' or not link.hostname or link.username or link.password:raise ValueError('Paste a complete HTTPS Zoom or other meeting link.')
            pricing_mode=p.get('pricing_mode','fixed')
            if pricing_mode not in ['donation','fixed']:raise ValueError('Invalid contribution setting.')
            low,suggested,high=500,1500,3000
            if pricing_mode=='donation':
                from decimal import Decimal
                amounts=[]
                for k in ['donation_min','donation_suggested','donation_max']:
                    value=Decimal(str(p[k]))*100
                    if not value.is_finite() or value!=value.to_integral_value():raise ValueError('Use contributions with up to two decimal places.')
                    amounts.append(int(value))
                low,suggested,high=amounts
                if not 0<=low<=suggested<=high<=1000000 or high<50 or any(0<v<50 for v in amounts):raise ValueError('Use minimum ≤ suggested ≤ maximum. Positive amounts must be at least €0.50.')
                price=suggested
            extra=workflows.options(p)
            eid=p.get('id') or str(uuid.uuid4())
            old=db.execute('SELECT * FROM events WHERE id=?',(eid,)).fetchone()
            if old and old['cancelled']:raise ValueError('Cancelled events cannot be edited. Duplicate the event to start again.')
            ticket_counts=db.execute("SELECT ticket_id,COUNT(*) AS n FROM bookings WHERE event_id=? AND status IN ('pending','confirmed','approval','waitlist') GROUP BY ticket_id",(eid,)).fetchall()
            incoming=json.loads(extra[3]) or [{'id':'standard','capacity':capacity}]
            for row in ticket_counts:
                t=next((t for t in incoming if t['id']==row['ticket_id']),None)
                if not t:raise ValueError('Keep ticket types that have active registrations.')
                occupied=db.execute("SELECT COUNT(*) FROM bookings WHERE event_id=? AND ticket_id=? AND status IN ('confirmed','pending')",(eid,row['ticket_id'])).fetchone()[0]
                if t['capacity']<occupied:raise ValueError('Ticket capacity is below existing reservations.')
            count=db.execute("SELECT COUNT(*) FROM bookings WHERE event_id=? AND status IN ('confirmed','pending')",(eid,)).fetchone()[0]
            if capacity<count:raise ValueError('Capacity cannot be below the number of confirmed and reserved seats.')
            db.execute('INSERT INTO events(id,title,description,starts,zone,location,hosts,capacity,price,published) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,description=excluded.description,starts=excluded.starts,zone=excluded.zone,location=excluded.location,hosts=excluded.hosts,capacity=excluded.capacity,price=excluded.price,published=excluded.published',(eid,title,str(p['description'])[:10000],p['starts'],p['zone'],location,hosts,capacity,price,int(bool(p['published']))))
            db.execute('UPDATE events SET ends=?,cover=? WHERE id=?',(ends,cover,eid))
            db.execute('UPDATE events SET approval=?,waitlist=?,visibility=?,tickets=?,questions=?,theme=? WHERE id=?',(*extra,eid))
            db.execute('UPDATE events SET description_html=? WHERE id=?',(html,eid))
            db.execute('UPDATE events SET host_ids=?,location_type=?,pricing_mode=?,donation_min=?,donation_suggested=?,donation_max=? WHERE id=?',(json.dumps(host_ids or []),location_type,pricing_mode,low,suggested,high,eid))
            return {'id':eid}
        eid=p.get('event_id');event=db.execute('SELECT * FROM events WHERE id=?',(eid,)).fetchone()
        if path=='/api/register':
            return workflows.register(db,event,p,email)
        if path in ['/api/pay','/api/cancel']:
            booking=db.execute('SELECT * FROM bookings WHERE id=?',(p.get('id'),)).fetchone()
            return workflows.transition(db,booking,path.rsplit('/',1)[1],email)
        if path=='/api/remind':
            if not event:raise ValueError('Event not found.')
            for b in db.execute("SELECT * FROM bookings WHERE event_id=? AND status='confirmed'",(eid,)).fetchall():
                email(db,b['email'],'Reminder: '+event['title'],f"We look forward to seeing you.\n{event['starts']} ({event['zone']})\n{event['location']}\nLocal preview only.")
            return {'ok':True}
        raise ValueError('Unknown action.')

if __name__=='__main__':
    load_config();setup();print('Local event prototype: http://127.0.0.1:8030',flush=True)
    ThreadingHTTPServer(('127.0.0.1',8030),Handler).serve_forever()
