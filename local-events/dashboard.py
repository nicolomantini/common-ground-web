"""Calendar and event management for the loopback-only prototype.
All messages are outbox previews. No live Stripe, bulk mail, or account permissions.
"""
import json, uuid, re
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

DEFAULTS = {'name':'Common Ground','description':'Meditation, inquiry, and meaningful conversations.','tint':'#9E5D54','website':'https://common-ground.space','instagram':'','default_visibility':'public','default_guest_list':False,'status':'active','seller_name':'Common Ground','seller_address':'','invoice_memo':'','refund_policy':'','tags':['Meditation','Inquiry','Shared practice']}

def migrate(db):
    db.executescript('''CREATE TABLE IF NOT EXISTS calendar_settings(id INTEGER PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS contacts(id TEXT PRIMARY KEY,name TEXT,email TEXT UNIQUE,subscribed INTEGER,tag TEXT,created TEXT);
CREATE TABLE IF NOT EXISTS campaigns(id TEXT PRIMARY KEY,event_id TEXT,subject TEXT,body TEXT,audience TEXT,status TEXT,created TEXT,scheduled TEXT);
CREATE TABLE IF NOT EXISTS invitations(id TEXT PRIMARY KEY,event_id TEXT,email TEXT,created TEXT,UNIQUE(event_id,email));
CREATE TABLE IF NOT EXISTS page_views(id TEXT PRIMARY KEY,event_id TEXT,created TEXT);
CREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY,booking_id TEXT UNIQUE,event_id TEXT,rating INTEGER,comment TEXT,created TEXT);
CREATE TABLE IF NOT EXISTS vouchers(code TEXT PRIMARY KEY,percent INTEGER,active INTEGER);
CREATE TABLE IF NOT EXISTS scheduled_previews(key TEXT PRIMARY KEY);
''')
    db.execute('INSERT OR IGNORE INTO calendar_settings VALUES(1,?)',(json.dumps(DEFAULTS),))
    additions={'events':{'registration_open':'INTEGER NOT NULL DEFAULT 1','guest_list_visible':'INTEGER NOT NULL DEFAULT 0','confirmation_message':"TEXT NOT NULL DEFAULT ''",'reminders':'INTEGER NOT NULL DEFAULT 0','feedback_enabled':'INTEGER NOT NULL DEFAULT 0','tags':"TEXT NOT NULL DEFAULT '[]'"},'emails':{'sent_at':"TEXT NOT NULL DEFAULT ''"},'bookings':{'voucher':"TEXT NOT NULL DEFAULT ''"}}
    for table,cols in additions.items():
        current={r[1] for r in db.execute('PRAGMA table_info('+table+')')}
        for key,definition in cols.items():
            if key not in current:db.execute(f'ALTER TABLE {table} ADD COLUMN {key} {definition}')

def now():return datetime.now(timezone.utc).isoformat()
def settings(db):return {**DEFAULTS,**json.loads(db.execute('SELECT value FROM calendar_settings WHERE id=1').fetchone()[0])}
def rows(db,table):return [dict(r) for r in db.execute('SELECT * FROM '+table)]
def snapshot(db):
    return {'email_usage':email_usage(db),'calendar':settings(db),**{t:rows(db,t) for t in ['contacts','campaigns','invitations','page_views','feedback','vouchers']}}
def text(p,key,limit=500,required=False):
    value=str(p.get(key,'')).strip()
    if len(value)>limit or (required and not value):raise ValueError('Check '+key.replace('_',' ')+'.')
    return value
def addresses(value):
    values=list(dict.fromkeys(x.strip().lower() for x in re.split(r'[,;\s]+',str(value)) if x.strip()))
    if not 1<=len(values)<=200 or any(not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',x) or len(x)>254 for x in values):raise ValueError('Enter up to 200 valid email addresses.')
    return values

def recipients(db,c):
    if c['event_id']:
        eligible=db.execute("SELECT DISTINCT email,status FROM bookings WHERE event_id=? AND status IN ('confirmed','approval','waitlist','pending')",(c['event_id'],)).fetchall()
        return sorted({b['email'] for b in eligible if c['audience']=='all' or b['status']==c['audience']})
    return [r[0] for r in db.execute('SELECT email FROM contacts WHERE subscribed=1')]

def queue_campaign(db,c,email):
    people=recipients(db,c)
    for address in people:email(db,address,c['subject'],c['body']+'\n\nLocal preview — Common Ground')
    db.execute("UPDATE campaigns SET status='queued' WHERE id=?",(c['id'],))
    return len(people)

def run_schedules(db,email):
    current=datetime.now(timezone.utc)
    for c in db.execute("SELECT * FROM campaigns WHERE status='scheduled'").fetchall():
        if datetime.fromisoformat(c['scheduled'])<=current:queue_campaign(db,c,email)
    for e in db.execute('SELECT * FROM events WHERE cancelled=0 AND (reminders=1 OR feedback_enabled=1)').fetchall():
        start=datetime.fromisoformat(e['starts']).replace(tzinfo=ZoneInfo(e['zone']))
        end=datetime.fromisoformat(e['ends']).replace(tzinfo=ZoneInfo(e['zone'])) if e['ends'] else start+timedelta(hours=1)
        tasks=[]
        if e['reminders'] and current<start:
            for hours in [24,1]:
                if start-timedelta(hours=hours)<=current:tasks.append((str(hours),f"Reminder: {e['title']}",f"{e['starts']} ({e['zone']})\n{e['location']}"))
        if e['feedback_enabled'] and current>=end:tasks.append(('feedback','How was '+e['title']+'?','Share your feedback using your local booking link.'))
        for kind,subject,body in tasks:
            for b in db.execute("SELECT * FROM bookings WHERE event_id=? AND status='confirmed'",(e['id'],)).fetchall():
                key=e['id']+':'+kind+':'+b['id']
                if db.execute('INSERT OR IGNORE INTO scheduled_previews VALUES(?)',(key,)).rowcount:
                    email(db,b['email'],subject,body+'\nhttp://127.0.0.1:8030/?booking='+b['id']+'\nLocal preview only.')

def action(db,path,p,email):
    if path=='/api/calendar-settings':
        value=settings(db)
        for key in ['name','description','website','instagram','seller_name','seller_address','invoice_memo','refund_policy']:
            if key in p:value[key]=text(p,key,2000,key=='name')
        if 'tint' in p:
            if not re.fullmatch(r'#[0-9a-fA-F]{6}',str(p['tint'])):raise ValueError('Choose a valid colour.')
            value['tint']=p['tint']
        for key,allowed in [('default_visibility',['public','unlisted']),('status',['active','coming_soon','archived'])]:
            if key in p:
                if p[key] not in allowed:raise ValueError('Invalid '+key)
                value[key]=p[key]
        if 'default_guest_list' in p:value['default_guest_list']=bool(p['default_guest_list'])
        if 'tags' in p:
            if not isinstance(p['tags'],list) or len(p['tags'])>30:raise ValueError('Use up to 30 tags.')
            value['tags']=list(dict.fromkeys(str(t).strip()[:60] for t in p['tags'] if str(t).strip()))
        db.execute('UPDATE calendar_settings SET value=? WHERE id=1',(json.dumps(value),));return {'ok':True}
    if path=='/api/contact':
        for address in addresses(p.get('emails','')):
            db.execute('INSERT INTO contacts VALUES(?,?,?,?,?,?) ON CONFLICT(email) DO UPDATE SET name=excluded.name,subscribed=excluded.subscribed,tag=excluded.tag',(str(uuid.uuid4()),text(p,'name',120) or address.split('@')[0],address,int(bool(p.get('subscribed'))),text(p,'tag',60),now()))
        return {'ok':True}
    if path=='/api/voucher':
        code=text(p,'code',40,True).upper();percent=int(p.get('percent',0))
        if not re.fullmatch(r'[A-Z0-9_-]+',code) or not 1<=percent<=100:raise ValueError('Use a simple code and discount from 1 to 100%.')
        db.execute('INSERT INTO vouchers VALUES(?,?,?) ON CONFLICT(code) DO UPDATE SET percent=excluded.percent,active=excluded.active',(code,percent,int(bool(p.get('active',True)))));return {'ok':True}
    if path=='/api/campaign':
        cid=p.get('id') or str(uuid.uuid4());eid=p.get('event_id','');audience=p.get('audience','subscribers')
        if eid and not db.execute('SELECT 1 FROM events WHERE id=?',(eid,)).fetchone():raise ValueError('Event not found.')
        if audience not in (['confirmed','approval','waitlist','all'] if eid else ['subscribers']):raise ValueError('Invalid audience.')
        old=db.execute('SELECT * FROM campaigns WHERE id=?',(cid,)).fetchone()
        if old and (old['status']!='draft' or old['event_id']!=eid):raise ValueError('Only drafts belonging to this calendar or event can be edited.')
        subject=text(p,'subject',150,True);body=text(p,'body',10000,True)
        db.execute('INSERT INTO campaigns VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET subject=excluded.subject,body=excluded.body,audience=excluded.audience',(cid,eid,subject,body,audience,'draft',now(),''))
        return {'id':cid}
    if path=='/api/campaign-queue':
        c=db.execute('SELECT * FROM campaigns WHERE id=?',(p.get('id'),)).fetchone()
        if not c:raise ValueError('Draft not found.')
        if c['status']=='queued':return {'count':0}
        scheduled=p.get('scheduled','')
        if scheduled:
            date=datetime.fromisoformat(scheduled)
            if date.tzinfo is None or date<=datetime.now(timezone.utc):raise ValueError('Choose a future date and time.')
            db.execute("UPDATE campaigns SET status='scheduled',scheduled=? WHERE id=?",(date.isoformat(),c['id']));return {'count':0}
        return {'count':queue_campaign(db,c,email)}
    if path=='/api/view':
        eid=str(p.get('event_id',''))
        if eid and not db.execute('SELECT 1 FROM events WHERE id=?',(eid,)).fetchone():raise ValueError('Event not found.')
        db.execute('INSERT INTO page_views VALUES(?,?,?)',(str(uuid.uuid4()),eid,now()));return {'ok':True}
    if path=='/api/feedback':
        b=db.execute("SELECT * FROM bookings WHERE id=? AND status='confirmed'",(p.get('booking_id'),)).fetchone()
        if not b:raise ValueError('A confirmed booking is required.')
        e=db.execute('SELECT * FROM events WHERE id=?',(b['event_id'],)).fetchone()
        if datetime.fromisoformat(e['ends'] or e['starts']).replace(tzinfo=ZoneInfo(e['zone']))>datetime.now(timezone.utc):raise ValueError('Feedback opens after the event.')
        rating=int(p.get('rating',0))
        if not 1<=rating<=5:raise ValueError('Choose a rating from 1 to 5.')
        db.execute('INSERT INTO feedback VALUES(?,?,?,?,?,?) ON CONFLICT(booking_id) DO UPDATE SET rating=excluded.rating,comment=excluded.comment',(str(uuid.uuid4()),b['id'],b['event_id'],rating,text(p,'comment',2000),now()))
        return {'ok':True}
    e=db.execute('SELECT * FROM events WHERE id=?',(p.get('event_id'),)).fetchone()
    if not e:raise ValueError('Event not found.')
    if path=='/api/event-options':
        for key in ['registration_open','guest_list_visible','reminders','feedback_enabled']:
            if key in p:db.execute('UPDATE events SET '+key+'=? WHERE id=?',(int(bool(p[key])),e['id']))
        if 'confirmation_message' in p:db.execute('UPDATE events SET confirmation_message=? WHERE id=?',(text(p,'confirmation_message',2000),e['id']))
        if 'tags' in p:
            if not isinstance(p['tags'],list) or any(t not in settings(db)['tags'] for t in p['tags']):raise ValueError('Choose a calendar tag.')
            db.execute('UPDATE events SET tags=? WHERE id=?',(json.dumps(p['tags']),e['id']))
        return {'ok':True}
    if path=='/api/invite':
        count=0
        for address in addresses(p.get('emails','')):
            if db.execute('INSERT OR IGNORE INTO invitations VALUES(?,?,?,?)',(str(uuid.uuid4()),e['id'],address,now())).rowcount:
                email(db,address,'Invitation: '+e['title'],text(p,'message',3000)+'\n\n'+e['starts']+'\nhttp://127.0.0.1:8030/?event='+e['id']+'\nLocal preview only.');count+=1
        return {'count':count}
    raise ValueError('Unknown dashboard action.')

PATHS={'/api/'+p for p in ['calendar-settings','contact','voucher','campaign','campaign-queue','view','feedback','event-options','invite']}


def email_usage(db):
    stamp=now()
    daily=db.execute("SELECT COUNT(*) FROM emails WHERE sent_id<>'' AND substr(sent_at,1,10)=?",(stamp[:10],)).fetchone()[0]
    monthly=db.execute("SELECT COUNT(*) FROM emails WHERE sent_id<>'' AND substr(sent_at,1,7)=?",(stamp[:7],)).fetchone()[0]
    return {'daily':daily,'monthly':monthly}

def check_send_limit(db):
    usage=email_usage(db)
    if usage['daily']>=100 or usage['monthly']>=3000:
        raise ValueError('Resend Free limit reached in this local tool (100/day, 3,000/month). Keep this message as a preview and try after the limit resets.')
