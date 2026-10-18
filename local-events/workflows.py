"""Local prototype workflows. No live payments, notifications, or host authentication."""
import json, uuid
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo

ACTIVE = ('confirmed', 'pending')

def migrate(db):
    changes={
        'events':{'host_ids':"TEXT NOT NULL DEFAULT '[]'",'location_type':"TEXT NOT NULL DEFAULT 'in_person'",'pricing_mode':"TEXT NOT NULL DEFAULT 'fixed'",'donation_min':'INTEGER NOT NULL DEFAULT 500','donation_suggested':'INTEGER NOT NULL DEFAULT 1500','donation_max':'INTEGER NOT NULL DEFAULT 3000','description_html':"TEXT NOT NULL DEFAULT ''",'approval':'INTEGER NOT NULL DEFAULT 0','waitlist':'INTEGER NOT NULL DEFAULT 1','visibility':"TEXT NOT NULL DEFAULT 'public'",'tickets':"TEXT NOT NULL DEFAULT '[]'",'questions':"TEXT NOT NULL DEFAULT '[]'",'cancelled':'INTEGER NOT NULL DEFAULT 0','theme':"TEXT NOT NULL DEFAULT 'peach'"},
        'bookings':{'ticket_id':"TEXT NOT NULL DEFAULT 'standard'",'ticket_name':"TEXT NOT NULL DEFAULT 'Standard'",'amount':'INTEGER NOT NULL DEFAULT 0','answers':"TEXT NOT NULL DEFAULT '[]'",'checked_in':'INTEGER NOT NULL DEFAULT 0'}
    }
    for table,columns in changes.items():
        present={r[1] for r in db.execute('PRAGMA table_info('+table+')')}
        for name,definition in columns.items():
            if name not in present:
                db.execute(f'ALTER TABLE {table} ADD COLUMN {name} {definition}')
                if table=='bookings' and name=='amount':db.execute('UPDATE bookings SET amount=COALESCE((SELECT price FROM events WHERE events.id=bookings.event_id),0)')

def options(p):
    tickets=p.get('tickets',[]);questions=p.get('questions',[])
    if not isinstance(tickets,list) or len(tickets)>12:raise ValueError('Use up to 12 ticket types.')
    seen=set();clean=[]
    for t in tickets:
        tid=str(t.get('id') or uuid.uuid4())
        if tid in seen:raise ValueError('Ticket IDs must be unique.')
        seen.add(tid)
        name=str(t['name']).strip();price=int(t['price']);capacity=int(t['capacity'])
        if not name or len(name)>100 or not 0<=price<=1000000 or not 1<=capacity<=10000:raise ValueError('Check ticket names, prices and quantities.')
        clean.append({'id':tid,'name':name,'price':price,'capacity':capacity})
    if not isinstance(questions,list) or len(questions)>10:raise ValueError('Use up to ten registration questions.')
    qs=[]
    for q in questions:
        label=str(q['label']).strip()
        if not label or len(label)>200:raise ValueError('Each question needs a short label.')
        qs.append({'id':str(q.get('id') or uuid.uuid4()),'label':label,'required':bool(q.get('required'))})
    visibility=p.get('visibility','public');theme=p.get('theme','peach')
    if visibility not in ['public','unlisted'] or theme not in ['peach','clay','paper']:raise ValueError('Invalid visibility or theme.')
    return (int(bool(p.get('approval'))),int(bool(p.get('waitlist',True))),visibility,json.dumps(clean),json.dumps(qs),theme)

def ticket_list(event):
    return json.loads(event['tickets']) or [{'id':'standard','name':'Standard','price':event['price'],'capacity':event['capacity']}]

def room(db,event,ticket):
    total=db.execute("SELECT COUNT(*) FROM bookings WHERE event_id=? AND status IN ('confirmed','pending')",(event['id'],)).fetchone()[0]
    count=db.execute("SELECT COUNT(*) FROM bookings WHERE event_id=? AND ticket_id=? AND status IN ('confirmed','pending')",(event['id'],ticket['id'])).fetchone()[0]
    return total<event['capacity'] and count<ticket['capacity']

def notify(db,email,b,event,subject):
    detail=event['location'] if b['status']=='confirmed' else 'Location and joining details are shared after confirmation.'
    email(db,b['email'],subject+': '+event['title'],f"Hello {b['name']},\n\nYour registration status: {b['status']}.\nTicket: {b['ticket_name']}\n{event['starts']} ({event['zone']})\n{detail}\n\nManage your local test booking: http://127.0.0.1:8030/?booking={b['id']}\n\nLocal test only — no real payment was processed.")

def register(db,event,p,email):
    if not event or not event['published'] or event['cancelled']:raise ValueError('This event is not open for registration.')
    start=datetime.fromisoformat(event['starts']).replace(tzinfo=ZoneInfo(event['zone']))
    if start<=datetime.now(timezone.utc):raise ValueError('Registration has closed because this event has started.')
    name=str(p['name']).strip();address=str(p['email']).strip().lower()
    if not name or len(name)>120 or '@' not in address or len(address)>254:raise ValueError('Enter a name and valid email.')
    existing=db.execute("SELECT * FROM bookings WHERE event_id=? AND email=? AND status IN ('pending','confirmed','waitlist','approval')",(event['id'],address)).fetchone()
    if existing:return dict(existing)
    tickets=ticket_list(event);ticket=next((t for t in tickets if t['id']==p.get('ticket_id',tickets[0]['id'])),None)
    if not ticket:raise ValueError('Choose an available ticket type.')
    amount=ticket['price']
    if event['pricing_mode']=='donation':
        from decimal import Decimal, InvalidOperation
        try:
            value=Decimal(str(p['contribution']))*100
            if not value.is_finite() or value!=value.to_integral_value():raise ValueError('Use an amount with up to two decimal places.')
            amount=int(value)
        except (InvalidOperation,KeyError):raise ValueError('Choose your contribution.')
        if not event['donation_min']<=amount<=event['donation_max'] or 0<amount<50:raise ValueError('Choose an amount within the event’s sliding scale (positive contributions start at €0.50).')
    answers=[];submitted=p.get('answers',{})
    for q in json.loads(event['questions']):
        answer=str(submitted.get(q['id'],'')).strip()
        if q['required'] and not answer:raise ValueError('Please answer: '+q['label'])
        if len(answer)>2000:raise ValueError('Answers must be under 2,000 characters.')
        answers.append({'label':q['label'],'answer':answer})
    if not room(db,event,ticket):
        if not event['waitlist']:raise ValueError('This ticket is sold out.')
        status='waitlist'
    else:status='approval' if event['approval'] else ('pending' if amount else 'confirmed')
    bid=str(uuid.uuid4());created=datetime.now(timezone.utc).isoformat()
    db.execute('INSERT INTO bookings(id,event_id,name,email,status,created,ticket_id,ticket_name,amount,answers) VALUES(?,?,?,?,?,?,?,?,?,?)',(bid,event['id'],name,address,status,created,ticket['id'],ticket['name'],amount,json.dumps(answers)))
    b=dict(db.execute('SELECT * FROM bookings WHERE id=?',(bid,)).fetchone())
    if status!='pending':notify(db,email,b,event,{'confirmed':'You’re registered','waitlist':'You’re on the waiting list','approval':'Registration requested'}[status])
    return b

def transition(db,b,action,email):
    if not b:raise ValueError('Registration not found.')
    event=db.execute('SELECT * FROM events WHERE id=?',(b['event_id'],)).fetchone()
    if event['cancelled'] and action!='cancel':raise ValueError('This event has been cancelled.')
    if action=='approve':
        if b['status'] not in ['approval','waitlist']:raise ValueError('Only requests and waiting-list registrations can be approved.')
        ticket=next((t for t in ticket_list(event) if t['id']==b['ticket_id']),None)
        if not ticket or not room(db,event,ticket):raise ValueError('No place available for this ticket. Increase capacity or free a place first.')
        status='pending' if b['amount'] else 'confirmed'
        db.execute('UPDATE bookings SET status=?,created=? WHERE id=?',(status,datetime.now(timezone.utc).isoformat(),b['id']))
    elif action=='decline':
        if b['status'] not in ['approval','waitlist']:raise ValueError('Only requests or waiting-list registrations can be declined.')
        status='declined';db.execute('UPDATE bookings SET status=? WHERE id=?',(status,b['id']))
    elif action=='checkin':
        if b['status']!='confirmed':raise ValueError('Only confirmed guests can check in.')
        db.execute('UPDATE bookings SET checked_in=1-checked_in WHERE id=?',(b['id'],));return {'status':b['status']}
    elif action=='pay':
        if b['status']=='confirmed':return {'status':'confirmed'}
        if b['status']!='pending':raise ValueError('This reservation has expired or is not ready for payment.')
        status='confirmed';db.execute('UPDATE bookings SET status=? WHERE id=?',(status,b['id']))
    elif action=='cancel':
        if b['status']=='cancelled':return {'status':'cancelled'}
        status='cancelled';db.execute('UPDATE bookings SET status=?,checked_in=0 WHERE id=?',(status,b['id']))
    else:raise ValueError('Unknown guest action.')
    updated=dict(db.execute('SELECT * FROM bookings WHERE id=?',(b['id'],)).fetchone())
    subject={'confirmed':'Booking confirmed','pending':'Place offered — complete your test checkout','declined':'Registration declined','cancelled':'Booking cancelled'}[status]
    notify(db,email,updated,event,subject)
    return {'status':status}

def action(db,path,p,email):
    if path=='/api/guest-action':
        ids=p.get('ids',[])
        if not isinstance(ids,list) or not 1<=len(ids)<=200:raise ValueError('Select between one and 200 guests.')
        for bid in dict.fromkeys(ids):
            b=db.execute('SELECT * FROM bookings WHERE id=?',(bid,)).fetchone()
            if not b or b['event_id']!=p['event_id']:raise ValueError('Guest does not belong to this event.')
            transition(db,b,p['action'],email)
        return {'ok':True}
    event=db.execute('SELECT * FROM events WHERE id=?',(p.get('event_id'),)).fetchone()
    if not event:raise ValueError('Event not found.')
    if path=='/api/duplicate':
        data=dict(event);data['id']=str(uuid.uuid4());data['title']+=' (copy)';data['published']=0;data['cancelled']=0
        db.execute('INSERT INTO events('+','.join(data)+') VALUES('+','.join('?' for _ in data)+')',tuple(data.values()))
        return {'id':data['id']}
    if path=='/api/cancel-event':
        if event['cancelled']:return {'ok':True}
        for b in db.execute("SELECT * FROM bookings WHERE event_id=? AND status IN ('pending','confirmed','approval','waitlist')",(event['id'],)).fetchall():transition(db,b,'cancel',email)
        db.execute('UPDATE events SET cancelled=1,published=0 WHERE id=?',(event['id'],));return {'ok':True}
    if path=='/api/blast':
        subject=str(p.get('subject','')).strip();body=str(p.get('body','')).strip();status=p.get('status','confirmed')
        if not subject or len(subject)>150 or not body or len(body)>5000 or status not in ['confirmed','approval','waitlist','all']:raise ValueError('Add a subject, message and audience.')
        rows=db.execute("SELECT * FROM bookings WHERE event_id=? AND status IN ('confirmed','approval','waitlist','pending')",(event['id'],)).fetchall();count=0
        for b in rows:
            if status!='all' and b['status']!=status:continue
            email(db,b['email'],subject,body+'\n\nLocal test message for '+event['title']);count+=1
        return {'count':count}
    raise ValueError('Unknown action.')

def calendar(event):
    def esc(s):return str(s).replace('\\','\\\\').replace('\n','\\n').replace('\r','').replace(';','\\;').replace(',','\\,')
    start=datetime.fromisoformat(event['starts']).replace(tzinfo=ZoneInfo(event['zone']))
    end=datetime.fromisoformat(event['ends']).replace(tzinfo=ZoneInfo(event['zone'])) if event['ends'] else start+timedelta(hours=1)
    fmt=lambda d:d.astimezone(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Common Ground//Local Events//EN','BEGIN:VEVENT','UID:'+event['id']+'@common-ground.space','DTSTAMP:'+fmt(datetime.now(timezone.utc)),'DTSTART:'+fmt(start),'DTEND:'+fmt(end),'SUMMARY:'+esc(event['title']),'DESCRIPTION:'+esc(event['description']),'LOCATION:'+esc(event['location']),'STATUS:'+('CANCELLED' if event['cancelled'] else 'CONFIRMED'),'END:VEVENT','END:VCALENDAR']
    # Fold at UTF-8 byte boundaries, respecting the iCalendar 75-octet limit.
    output=[]
    for line in lines:
        current=''
        for char in line:
            if len((current+char).encode())>74:output.append(current);current=' '
            current+=char
        output.append(current)
    return '\r\n'.join(output)+'\r\n'
