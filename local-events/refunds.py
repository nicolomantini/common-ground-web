"""48-hour cancellation policy and durable Stripe test refunds."""
from datetime import datetime,timezone,timedelta
from zoneinfo import ZoneInfo
import database
POLICY='If you can no longer attend, please let us know as soon as possible. Cancellations made at least 48 hours before the event are eligible for a refund. After that time, contributions are non-refundable, but you may transfer your place to another person. If we cancel the event, you will receive a full refund.'
def now():return datetime.now(timezone.utc)
def eligible(event,at=None):
    start=datetime.fromisoformat(event['starts'])
    if start.tzinfo is None:start=start.replace(tzinfo=ZoneInfo(event['zone']))
    return start.astimezone(timezone.utc)-(at or now()).astimezone(timezone.utc)>=timedelta(hours=48)
def migrate(db):
    fields={'cancelled_at':"TEXT NOT NULL DEFAULT ''",'cancellation_reason':"TEXT NOT NULL DEFAULT ''",'refund_status':"TEXT NOT NULL DEFAULT ''",'refund_amount':'INTEGER NOT NULL DEFAULT 0'}
    existing=database.columns(db,'bookings')
    for k,v in fields.items():
        if k not in existing:db.execute(f'ALTER TABLE bookings ADD COLUMN {k} {v}')
    db.execute("CREATE TABLE IF NOT EXISTS refund_jobs(booking_id TEXT PRIMARY KEY,payment_intent TEXT NOT NULL,amount INTEGER NOT NULL,created TEXT NOT NULL,refund_id TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'queued',attempts INTEGER NOT NULL DEFAULT 0,next_attempt TEXT NOT NULL DEFAULT '',error TEXT NOT NULL DEFAULT '')")
def queue(db,b,event,s,event_cancelled,at):
    if not s or s.get('payment_status')!='paid':return
    if db.execute('SELECT 1 FROM refund_jobs WHERE booking_id=?',(b['id'],)).fetchone():return
    if not event_cancelled and not eligible(event,at):
        db.execute("UPDATE bookings SET refund_status='not_eligible' WHERE id=?",(b['id'],));return
    pi=s.get('payment_intent')
    if not isinstance(pi,str) or not pi.startswith('pi_'):raise ValueError('Stripe payment reference missing. Cancellation could not be completed.')
    db.execute('INSERT INTO refund_jobs(booking_id,payment_intent,amount,created) VALUES(?,?,?,?)',(b['id'],pi,b['amount'],at.isoformat()))
    db.execute("UPDATE bookings SET refund_status='queued',refund_amount=? WHERE id=?",(b['amount'],b['id']))
def description(status):
    return {'queued':'Your full refund is queued automatically.','retry':'Your full refund is queued; we are retrying the payment provider.','pending':'Stripe is processing your full refund.','succeeded':'Your full refund has been processed by Stripe.','requires_action':'Your refund needs attention from the host.','failed':'Your refund needs attention from the host.','canceled':'Your refund needs attention from the host.','review':'Your refund needs attention from the host.','not_eligible':'This cancellation is less than 48 hours before the event, so the contribution is non-refundable.'}.get(status,'')
def process_one(connect,email):
    import payments
    if not payments.enabled():return False
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row=db.execute("SELECT * FROM refund_jobs WHERE status IN ('queued','retry','pending') AND next_attempt<=? ORDER BY created LIMIT 1",(now().isoformat(),)).fetchone()
        if not row:return False
        job=dict(row);bid=job['booking_id']
        if not job['refund_id'] and datetime.fromisoformat(job['created'])<now()-timedelta(hours=20):
            db.execute("UPDATE refund_jobs SET status='review',error='Automatic retry window ended.' WHERE booking_id=?",(bid,));db.execute("UPDATE bookings SET refund_status='review' WHERE id=?",(bid,));return True
        try:
            if job['refund_id']:r=payments.api('refunds/'+job['refund_id'])
            else:
                pi=payments.api('payment_intents/'+job['payment_intent'])
                if pi.get('livemode') is not False or pi.get('currency')!='eur' or pi.get('amount_received')!=job['amount']:raise ValueError('Stripe payment verification failed before refund.')
                r=payments.api('refunds',{'payment_intent':job['payment_intent'],'amount':job['amount'],'metadata[booking_id]':bid},'cg-full-refund-'+bid)
            if r.get('payment_intent')!=job['payment_intent'] or r.get('amount')!=job['amount'] or r.get('currency')!='eur':raise ValueError('Stripe refund details do not match.')
            status=r.get('status')
            if status not in ['pending','succeeded','failed','canceled','requires_action']:raise ValueError('Unknown Stripe refund status.')
            db.execute('UPDATE refund_jobs SET refund_id=?,status=?,attempts=attempts+1,next_attempt=?,error=? WHERE booking_id=?',(r['id'],status,(now()+timedelta(minutes=1)).isoformat(),r.get('failure_reason') or '',bid))
            db.execute('UPDATE bookings SET refund_status=? WHERE id=?',(status,bid))
            if status=='succeeded':
                b=db.execute('SELECT * FROM bookings WHERE id=?',(bid,)).fetchone();e=db.execute('SELECT title FROM events WHERE id=?',(b['event_id'],)).fetchone()
                getattr(email,'transactional',email)(db,b['email'],'Refund processed: '+e['title'],f"Your full test refund of EUR {job['amount']/100:.2f} has been processed by Stripe. No real money was charged or returned in this test.\n\nhttp://127.0.0.1:8030/guest.html")
        except ValueError as e:
            attempts=job['attempts']+1;status='review' if attempts>=8 else 'retry'
            db.execute('UPDATE refund_jobs SET status=?,attempts=?,next_attempt=?,error=? WHERE booking_id=?',(status,attempts,(now()+timedelta(seconds=min(3600,30*2**attempts))).isoformat(),str(e),bid))
            db.execute('UPDATE bookings SET refund_status=? WHERE id=?',(status,bid))
        return True
