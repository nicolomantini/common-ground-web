"""Local guest magic-link flow. Outbox previews only; host demo remains unauthenticated."""
import hashlib, secrets, re
from datetime import datetime, timezone, timedelta
from http.cookies import SimpleCookie
import workflows

def digest(value):return hashlib.sha256(str(value).encode()).hexdigest()
def now():return datetime.now(timezone.utc)
def migrate(db):
    db.executescript('''CREATE TABLE IF NOT EXISTS guest_links(token_hash TEXT PRIMARY KEY,email TEXT,expires TEXT,created TEXT,used INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS guest_sessions(token_hash TEXT PRIMARY KEY,email TEXT,expires TEXT);''')
def request_link(db,address,email):
    address=str(address).strip().lower()
    if len(address)>254 or not re.fullmatch(r'[^\s@]+@[^\s@]+\.[^\s@]+',address):raise ValueError('Enter a valid email address.')
    recent=db.execute('SELECT 1 FROM guest_links WHERE email=? AND created>?',(address,(now()-timedelta(seconds=60)).isoformat())).fetchone()
    if not recent:
        token=secrets.token_urlsafe(32)
        db.execute('UPDATE guest_links SET used=1 WHERE email=?',(address,))
        db.execute('INSERT INTO guest_links VALUES(?,?,?,?,0)',(digest(token),address,(now()+timedelta(minutes=15)).isoformat(),now().isoformat()))
        getattr(email,'transactional',email)(db,address,'Your Common Ground sign-in link','Sign in to see your bookings and manage your places.\n\nhttp://127.0.0.1:8030/guest.html#token='+token+'\n\nThis link expires in 15 minutes and works once. If you did not request it, ignore this message.\nLocal prototype: this link works only on this computer.')
    return {'ok':True,'retry_after':60 if recent else 0}
def consume(db,token):
    row=db.execute('SELECT * FROM guest_links WHERE token_hash=?',(digest(token),)).fetchone()
    if not row or row['used'] or row['expires']<=now().isoformat():raise ValueError('This sign-in link has expired or was already used. Request a new one.')
    db.execute('UPDATE guest_links SET used=1 WHERE token_hash=?',(row['token_hash'],))
    session=secrets.token_urlsafe(32)
    db.execute('INSERT INTO guest_sessions VALUES(?,?,?)',(digest(session),row['email'],(now()+timedelta(days=7)).isoformat()))
    return session

def cookie_token(header):
    try:
        cookie=SimpleCookie();cookie.load(header or '')
        return cookie['cg_guest'].value if 'cg_guest' in cookie else ''
    except Exception:return ''
def identity(db,header):
    row=db.execute('SELECT email FROM guest_sessions WHERE token_hash=? AND expires>?',(digest(cookie_token(header)),now().isoformat())).fetchone()
    if not row:raise PermissionError('Sign in to see your bookings.')
    return row['email']
def bookings(db,address):
    import refunds
    result=[]
    for b in db.execute('SELECT * FROM bookings WHERE lower(email)=? ORDER BY created DESC',(address,)):
        event=db.execute('SELECT * FROM events WHERE id=?',(b['event_id'],)).fetchone()
        if not event:continue
        result.append({'id':b['id'],'status':b['status'],'amount':b['amount'],'name':b['name'],'ticket_name':b['ticket_name'],'refund_status':b['refund_status'],'refund_amount':b['refund_amount'],'refund_message':refunds.description(b['refund_status']),'refund_eligible':refunds.eligible(event),'event':{k:event[k] for k in ['id','title','starts','ends','zone','cover','location_type','cancelled']},'location':event['location'] if b['status']=='confirmed' else '', 'can_cancel':b['status'] in ['confirmed','pending','approval','waitlist']})
    return {'email':address,'bookings':result}
def cancel(db,address,bid,email):
    b=db.execute('SELECT * FROM bookings WHERE id=? AND lower(email)=?',(bid,address)).fetchone()
    if not b:raise ValueError('Booking not found in your account.')
    if b['status'] not in ['confirmed','pending','approval','waitlist','cancelled']:raise ValueError('This booking is no longer active.')
    return workflows.transition(db,b,'cancel',email)
def logout(db,header):db.execute('DELETE FROM guest_sessions WHERE token_hash=?',(digest(cookie_token(header)),))
def session_cookie(token):return 'cg_guest='+token+'; Path=/; HttpOnly; SameSite=Strict; Max-Age='+('604800' if token else '0')
