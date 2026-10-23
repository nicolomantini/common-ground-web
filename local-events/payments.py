"""Stripe test Checkout, verified server-side. Local polling replaces public webhooks."""
import json,os,time,threading,logging
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urlencode
from urllib.error import HTTPError,URLError
KEY=Path.home()/'.config/common-ground/stripe-test-key'
def enabled():return os.environ.get('STRIPE_MODE')=='test'
def api(path,params=None,key=None):
    secret=KEY.read_text().strip()
    if not secret.startswith('sk_test_'):raise ValueError('Only a Stripe test secret key is allowed.')
    headers={'Authorization':'Bearer '+secret,'Stripe-Version':'2025-02-24.acacia'}
    if key:headers['Idempotency-Key']=key
    req=Request('https://api.stripe.com/v1/'+path,headers=headers,data=urlencode(params).encode() if params is not None else None)
    try:
        with urlopen(req,timeout=15) as response:return json.load(response)
    except (HTTPError,URLError,TimeoutError):raise ValueError('Stripe could not complete this request. Please retry shortly.') from None

def migrate(db):
    db.execute("CREATE TABLE IF NOT EXISTS stripe_checkouts(booking_id TEXT PRIMARY KEY,session_id TEXT NOT NULL DEFAULT '',payload TEXT NOT NULL,created INTEGER NOT NULL,error TEXT NOT NULL DEFAULT '')")

def prepare(db,bid):
    b=db.execute('SELECT * FROM bookings WHERE id=?',(bid,)).fetchone()
    if not b or b['status']!='pending' or b['amount']<50:raise ValueError('This booking is not awaiting payment.')
    if db.execute('SELECT 1 FROM stripe_checkouts WHERE booking_id=?',(bid,)).fetchone():return
    e=db.execute('SELECT * FROM events WHERE id=?',(b['event_id'],)).fetchone()
    if not e or e['cancelled']:raise ValueError('This event is cancelled.')
    payload={'mode':'payment','payment_method_types[0]':'card','line_items[0][quantity]':'1','line_items[0][price_data][currency]':'eur','line_items[0][price_data][unit_amount]':str(b['amount']),'line_items[0][price_data][product_data][name]':e['title'],'customer_email':b['email'],'client_reference_id':bid,'metadata[booking_id]':bid,'success_url':'http://127.0.0.1:8030/?booking='+bid+'&stripe=return','cancel_url':'http://127.0.0.1:8030/?booking='+bid,'expires_at':str(int(time.time())+1860)}
    db.execute('INSERT INTO stripe_checkouts(booking_id,payload,created) VALUES(?,?,?)',(bid,json.dumps(payload),int(time.time())))

def session(db,bid):
    row=db.execute('SELECT * FROM stripe_checkouts WHERE booking_id=?',(bid,)).fetchone()
    if not row:return None
    if row['session_id']:
        s=api('checkout/sessions/'+row['session_id'])
    else:
        if int(time.time())-row['created']>20*3600:raise ValueError('Checkout requires administrator review before retrying.')
        s=api('checkout/sessions',json.loads(row['payload']),'cg-checkout-'+bid)
        if s.get('livemode') is not False:raise ValueError('Live Stripe sessions are not allowed.')
        db.execute('UPDATE stripe_checkouts SET session_id=? WHERE booking_id=?',(s['id'],bid))
    if s.get('livemode') is not False:raise ValueError('Live Stripe sessions are not allowed.')
    return s

def reconcile(db,bid,s,email):
    import workflows
    b=db.execute('SELECT * FROM bookings WHERE id=?',(bid,)).fetchone()
    if not b:return
    if s.get('payment_status')=='paid':
        if s.get('currency')!='eur' or s.get('amount_total')!=b['amount'] or s.get('client_reference_id')!=bid or s.get('metadata',{}).get('booking_id')!=bid:raise ValueError('Stripe payment details do not match this booking.')
        if b['status']=='pending':workflows.transition(db,b,'pay',email)
    elif s.get('status')=='expired' and b['status']=='pending':db.execute("UPDATE bookings SET status='expired' WHERE id=?",(bid,))

def checkout(connect,bid,email):
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        b=db.execute('SELECT * FROM bookings WHERE id=?',(bid,)).fetchone()
        if not b or b['status']!='pending':return {'status':b['status'] if b else 'missing'}
        s=session(db,bid);reconcile(db,bid,s,email)
        if s['status']=='open':return {'url':s['url']}
        return {'status':db.execute('SELECT status FROM bookings WHERE id=?',(bid,)).fetchone()[0]}

def before_cancel(db,b,email):
    if not db.execute('SELECT 1 FROM stripe_checkouts WHERE booking_id=?',(b['id'],)).fetchone():return
    s=session(db,b['id'])
    if s['status']=='open':
        try:s=api('checkout/sessions/'+s['id']+'/expire',{})
        except ValueError:
            s=session(db,b['id'])
            if s['status']=='open':raise
    reconcile(db,b['id'],s,email)
    return s

def start(connect,email):
    if not enabled():return
    def run():
        while True:
            try:
                with connect() as db:ids=[r[0] for r in db.execute("SELECT s.booking_id FROM stripe_checkouts s JOIN bookings b ON b.id=s.booking_id WHERE b.status='pending'")]
                for bid in ids:
                    try:checkout(connect,bid,email)
                    except ValueError as e:
                        with connect() as db:db.execute('UPDATE stripe_checkouts SET error=? WHERE booking_id=?',(str(e),bid))
            except Exception:logging.warning('Stripe test reconciliation will retry.')
            try:
                import refunds
                refunds.process_one(connect,email)
            except Exception:logging.warning('Stripe test refund reconciliation will retry.')
            threading.Event().wait(30)
    threading.Thread(target=run,daemon=True,name='stripe-test-reconcile').start()
