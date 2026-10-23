"""Durable transactional test outbox. No newsletters, invitations or old previews."""
import re,threading,logging
from datetime import datetime,timezone,timedelta
import database,mailer,guest_auth

def now():return datetime.now(timezone.utc)
def migrate(db):
    fields={'delivery_created':"TEXT NOT NULL DEFAULT ''",'delivery_status':"TEXT NOT NULL DEFAULT 'preview'",'delivery_attempts':'INTEGER NOT NULL DEFAULT 0','delivery_next':"TEXT NOT NULL DEFAULT ''",'delivery_first':"TEXT NOT NULL DEFAULT ''",'delivery_error':"TEXT NOT NULL DEFAULT ''"}
    present=database.columns(db,'emails')
    for name,definition in fields.items():
        if name not in present:db.execute(f'ALTER TABLE emails ADD COLUMN {name} {definition}')

def check_quota(db):
    # Count potentially accepted sends too, since a timed-out request may have succeeded.
    daily=db.execute("SELECT count(*) FROM emails WHERE substr(sent_at,1,10)=? OR substr(delivery_first,1,10)=?",(now().isoformat()[:10],now().isoformat()[:10])).fetchone()[0]
    monthly=db.execute("SELECT count(*) FROM emails WHERE substr(sent_at,1,7)=? OR substr(delivery_first,1,7)=?",(now().isoformat()[:7],now().isoformat()[:7])).fetchone()[0]
    if daily>=100 or monthly>=3000:raise ValueError('Local Resend allowance reached. Delivery is paused.')

def process_one(connect):
    if not mailer.automatic_enabled():return False
    with connect() as db:
        db.execute('BEGIN IMMEDIATE')
        row=db.execute("SELECT * FROM emails WHERE delivery_status IN ('queued','retry') AND sent_id='' AND delivery_next<=? ORDER BY delivery_next,id LIMIT 1",(now().isoformat(),)).fetchone()
        if not row:return False
        m=dict(row)
        if m['recipient'].lower() not in mailer.allowed_recipients():
            db.execute("UPDATE emails SET delivery_status='blocked',delivery_error='Recipient is not on the test allowlist.' WHERE id=?",(m['id'],));return True
        token=re.search(r'/guest.html#token=([^\s]+)',m['body'])
        if token:
            link=db.execute('SELECT * FROM guest_links WHERE token_hash=?',(guest_auth.digest(token.group(1)),)).fetchone()
            if not link or link['used'] or link['expires']<=now().isoformat():
                db.execute("UPDATE emails SET delivery_status='expired',delivery_error='Sign-in link expired or was replaced.' WHERE id=?",(m['id'],));return True
        if not m['delivery_created'] or datetime.fromisoformat(m['delivery_created'])<now()-timedelta(hours=20):
            db.execute("UPDATE emails SET delivery_status='failed',delivery_error='Retry window ended; review delivery before resending.' WHERE id=?",(m['id'],));return True
        if not m['delivery_first']:
            try:check_quota(db)
            except ValueError:
                db.execute("UPDATE emails SET delivery_next=?,delivery_error='Local allowance reached; waiting.' WHERE id=?",((now()+timedelta(minutes=30)).isoformat(),m['id']));return True
        attempts=m['delivery_attempts']+1
        db.execute('UPDATE emails SET delivery_attempts=?,delivery_first=? WHERE id=?',(attempts,m['delivery_first'] or now().isoformat(),m['id']))
        try:
            sent=mailer.send_preview(m,transactional=True)
        except ValueError as e:
            db.execute('UPDATE emails SET delivery_status=?,delivery_next=?,delivery_error=? WHERE id=?',('failed' if attempts>=5 else 'retry',(now()+timedelta(seconds=60*2**(attempts-1))).isoformat(),str(e)[:400],m['id']))
        else:
            db.execute("UPDATE emails SET sent_id=?,sent_at=?,delivery_status='accepted',delivery_error='' WHERE id=?",(sent,now().isoformat(),m['id']))
        return True

def start(connect):
    def run():
        while True:
            try:process_one(connect)
            except Exception:logging.warning('Test email worker could not complete this pass; retrying.')
            threading.Event().wait(5)
    threading.Thread(target=run,name='test-email-outbox',daemon=True).start()
