"""Server-side test host accounts and authorization; no production credentials."""
import hashlib,hmac,secrets,json,re
from datetime import datetime,timezone,timedelta
from http.cookies import SimpleCookie
import guest_auth

def stamp():return datetime.now(timezone.utc)
def password_hash(password,salt=None):
    if not 12<=len(password)<=1024:raise ValueError('Use a password of at least 12 characters.')
    salt=salt or secrets.token_hex(16)
    return salt+':'+hashlib.scrypt(password.encode(),salt=salt.encode(),n=16384,r=8,p=1).hex()
def migrate(db):
    db.executescript('''CREATE TABLE IF NOT EXISTS host_accounts(email TEXT PRIMARY KEY,practitioner_id TEXT,admin INTEGER NOT NULL DEFAULT 0,password_hash TEXT NOT NULL,active INTEGER NOT NULL DEFAULT 1);
CREATE TABLE IF NOT EXISTS host_sessions(token_hash TEXT PRIMARY KEY,email TEXT,expires TEXT);
CREATE TABLE IF NOT EXISTS host_attempts(email TEXT PRIMARY KEY,failures INTEGER,reset_at TEXT);''')
def cookie(token):return 'cg_host='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+('28800' if token else '0')
def token(header):
    try:return SimpleCookie(header or '')['cg_host'].value
    except (KeyError,ValueError):return ''
def identity(db,header):
    return db.execute('SELECT a.* FROM host_accounts a JOIN host_sessions s ON a.email=s.email WHERE s.token_hash=? AND s.expires>? AND a.active=1',(guest_auth.digest(token(header)),stamp().isoformat())).fetchone()
def login(db,p):
    email=str(p.get('email','')).strip().lower();password=str(p.get('password',''))
    attempt=db.execute('SELECT * FROM host_attempts WHERE email=?',(email,)).fetchone()
    if attempt and attempt['reset_at']>stamp().isoformat() and attempt['failures']>=5:return {'error':'Too many attempts. Try again in 15 minutes.'}
    a=db.execute('SELECT * FROM host_accounts WHERE email=? AND active=1',(email,)).fetchone()
    valid=False
    if a and 1<=len(password)<=1024:
        salt=a['password_hash'].split(':')[0]
        candidate=salt+':'+hashlib.scrypt(password.encode(),salt=salt.encode(),n=16384,r=8,p=1).hex()
        valid=hmac.compare_digest(candidate,a['password_hash'])
    if not valid:
        count=attempt['failures']+1 if attempt and attempt['reset_at']>stamp().isoformat() else 1
        reset=attempt['reset_at'] if count>1 else (stamp()+timedelta(minutes=15)).isoformat()
        db.execute('INSERT INTO host_attempts VALUES(?,?,?) ON CONFLICT(email) DO UPDATE SET failures=excluded.failures,reset_at=excluded.reset_at',(email[:254],count,reset))
        return {'error':'Email or password is incorrect.'}
    db.execute('DELETE FROM host_attempts WHERE email=?',(email,))
    value=secrets.token_urlsafe(32)
    db.execute('INSERT INTO host_sessions VALUES(?,?,?)',(guest_auth.digest(value),email,(stamp()+timedelta(hours=8)).isoformat()))
    return {'token':value}
def manage_account(db,p):
    email=str(p.get('email','')).strip().lower();pid=str(p.get('practitioner_id',''))
    if not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',email) or len(email)>254:raise ValueError('Enter a valid email.')
    old=db.execute('SELECT * FROM host_accounts WHERE email=?',(email,)).fetchone()
    if old and old['admin']:raise ValueError('Administrator access cannot be changed here.')
    if not db.execute('SELECT 1 FROM practitioners WHERE id=?',(pid,)).fetchone():raise ValueError('Choose a practitioner.')
    password=str(p.get('password',''))
    hashed=password_hash(password) if password else old['password_hash'] if old else password_hash('')
    db.execute('INSERT INTO host_accounts VALUES(?,?,0,?,?) ON CONFLICT(email) DO UPDATE SET practitioner_id=excluded.practitioner_id,password_hash=excluded.password_hash,active=excluded.active',(email,pid,hashed,int(bool(p.get('active',True)))))
    db.execute('DELETE FROM host_sessions WHERE email=?',(email,))
    return {'ok':True}
def can_manage(a,e):return bool(a and e and (a['admin'] or a['practitioner_id'] in json.loads(e['host_ids'] or '[]')))
def owned_booking(db,header,bid):
    b=db.execute('SELECT * FROM bookings WHERE id=?',(bid,)).fetchone()
    if not b:raise PermissionError('Booking not available.')
    a=identity(db,header);e=db.execute('SELECT * FROM events WHERE id=?',(b['event_id'],)).fetchone()
    if can_manage(a,e):return b
    address=guest_auth.identity(db,header)
    if b['email'].lower()!=address:raise PermissionError('This booking belongs to another guest.')
    return b

def authorize(db,path,p,header):
    if path in ['/api/host-login','/api/host-logout','/api/guest-request','/api/guest-consume','/api/guest-logout','/api/guest-cancel']:return
    if path in ['/api/pay','/api/cancel','/api/feedback']:
        owned_booking(db,header,p.get('booking_id') if path.endswith('feedback') else p.get('id'));return
    if path=='/api/register':
        address=guest_auth.identity(db,header)
        if str(p.get('email','')).strip().lower()!=address:raise PermissionError('Use the email you signed in with.')
        return
    if path=='/api/view':
        e=db.execute('SELECT * FROM events WHERE id=?',(p.get('event_id'),)).fetchone()
        if not e or not e['published'] or e['cancelled']:raise PermissionError('Event not available.')
        return
    a=identity(db,header)
    if not a:raise PermissionError('Sign in as a host.')
    if path in ['/api/host-account','/api/calendar-settings','/api/contact','/api/voucher','/api/send-preview']:
        if not a['admin']:raise PermissionError('Administrator access required.')
        return
    if path=='/api/event':
        e=db.execute('SELECT * FROM events WHERE id=?',(p.get('id'),)).fetchone() if p.get('id') else None
        if p.get('id') and not can_manage(a,e):raise PermissionError('You are not a host of this event.')
        if not a['admin'] and a['practitioner_id'] not in p.get('host_ids',[]):raise PermissionError('Keep yourself assigned as a host.')
        return
    eid=p.get('event_id')
    if path in ['/api/campaign','/api/campaign-queue']:
        c=db.execute('SELECT * FROM campaigns WHERE id=?',(p.get('id'),)).fetchone()
        if c:
            if path=='/api/campaign' and c['event_id']!=p.get('event_id',''):raise PermissionError('Campaign event cannot change.')
            eid=c['event_id']
        if not eid:
            if not a['admin']:raise PermissionError('Administrator access required.')
            return
    if not can_manage(a,db.execute('SELECT * FROM events WHERE id=?',(eid,)).fetchone()):raise PermissionError('You are not a host of this event.')

def filter_state(db,state,header,public=False,event_id=''):
    a=identity(db,header)
    if not public:
        if not a:raise PermissionError('Sign in as a host.')
        state['host']={k:a[k] for k in ['email','admin','practitioner_id']}
        if a['admin']:
            state['host_accounts']=[dict(r) for r in db.execute('SELECT email,practitioner_id,admin,active FROM host_accounts ORDER BY email')]
            return state
        state['events']=[e for e in state['events'] if can_manage(a,e)]
        ids={e['id'] for e in state['events']}
        for key in ['bookings','campaigns','invitations','page_views','feedback']:state[key]=[r for r in state[key] if r['event_id'] in ids]
        for key in ['contacts','emails','vouchers']:state[key]=[]
        state['email_usage']={'daily':0,'monthly':0}
        return state
    try:address=guest_auth.identity(db,header)
    except PermissionError:address=None
    state['bookings']=[b for b in state['bookings'] if address and b['email'].lower()==address]
    owned={b['event_id'] for b in state['bookings']}
    events=[]
    for e in state['events']:
        if not (e['id'] in owned or (e['published'] and not e['cancelled'] and (e['visibility']=='public' or e['id']==event_id))):continue
        e['reserved_count']=db.execute("SELECT count(*) FROM bookings WHERE event_id=? AND status IN ('pending','confirmed')",(e['id'],)).fetchone()[0]
        confirmed=any(b['event_id']==e['id'] and b['status']=='confirmed' for b in state['bookings'])
        if not confirmed:
            if e['location_type']=='online':e['location']=''
            e['confirmation_message']=''
        events.append(e)
    state['events']=events
    for key in ['emails','contacts','campaigns','invitations','page_views','feedback','vouchers']:state[key]=[]
    state['calendar']={'refund_policy':state['calendar'].get('refund_policy','')}
    state['email_usage']={'daily':0,'monthly':0}
    state['guest_email']=address
    return state
