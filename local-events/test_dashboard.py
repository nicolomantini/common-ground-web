import tempfile, unittest, json
from pathlib import Path
from unittest.mock import patch
from datetime import datetime, timezone, timedelta
import server, dashboard

class DashboardTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();server.DB=Path(self.tmp.name)/'db';server.setup()
        with server.connect() as db:db.execute("UPDATE events SET starts='2099-01-01T10:00',price=1000 WHERE id='demo'")
    def tearDown(self):self.tmp.cleanup()
    def act(self,name,p):
        with server.connect() as db:
            db.execute('BEGIN IMMEDIATE')
            return server.Handler.action(None,db,'/api/'+name,p)
    def booking(self,email='guest@example.com',**extra):return self.act('register',dict(event_id='demo',name='Guest',email=email,**extra))
    def count(self,table):
        with server.connect() as db:return db.execute('SELECT COUNT(*) FROM '+table).fetchone()[0]
    def test_contacts_consent_campaign_and_idempotency(self):
        self.act('contact',dict(emails='one@example.com',subscribed=True))
        self.act('contact',dict(emails='two@example.com',subscribed=False))
        c=self.act('campaign',dict(subject='Hello',body='Invitation',audience='subscribers'))
        self.assertEqual(self.act('campaign-queue',c)['count'],1)
        self.assertEqual(self.act('campaign-queue',c)['count'],0)
        self.assertEqual(self.count('emails'),1)
        with self.assertRaises(ValueError):self.act('campaign',dict(**c,subject='Changed',body='No',audience='subscribers'))
    def test_closed_registration_and_custom_confirmation(self):
        self.act('event-options',dict(event_id='demo',registration_open=False))
        with self.assertRaises(ValueError):self.booking()
        self.act('event-options',dict(event_id='demo',registration_open=True,confirmation_message='Bring a cushion'))
        b=self.booking();self.act('pay',b)
        with server.connect() as db:self.assertIn('Bring a cushion',db.execute('SELECT body FROM emails').fetchone()[0])
    def test_voucher_and_invites(self):
        self.act('voucher',dict(code='WELCOME',percent=100))
        b=self.booking(voucher='welcome');self.assertEqual(b['status'],'confirmed');self.assertEqual(b['amount'],0)
        self.act('voucher',dict(code='WELCOME',percent=100,active=False))
        with self.assertRaises(ValueError):self.booking('other@example.com',voucher='welcome')
        p=dict(event_id='demo',emails='friend@example.com, friend@example.com',message='Come along')
        self.assertEqual(self.act('invite',p)['count'],1);self.assertEqual(self.act('invite',p)['count'],0)
    def test_scheduled_previews_once(self):
        self.act('contact',dict(emails='one@example.com',subscribed=True))
        c=self.act('campaign',dict(subject='Hi',body='Hello',audience='subscribers'))
        self.act('campaign-queue',dict(**c,scheduled=(datetime.now(timezone.utc)+timedelta(days=1)).isoformat()))
        with server.connect() as db:
            db.execute("UPDATE campaigns SET scheduled='2000-01-01T00:00:00+00:00'")
            dashboard.run_schedules(db,server.email);dashboard.run_schedules(db,server.email)
        self.assertEqual(self.count('emails'),1)
    def test_feedback_after_event_only(self):
        self.act('voucher',dict(code='FREE',percent=100));b=self.booking(voucher='FREE')
        p=dict(booking_id=b['id'],rating=5,comment='Loved it')
        with self.assertRaises(ValueError):self.act('feedback',p)
        with server.connect() as db:db.execute("UPDATE events SET starts='2000-01-01T10:00' WHERE id='demo'")
        self.act('feedback',p);self.act('feedback',dict(p,rating=4));self.assertEqual(self.count('feedback'),1)
    def test_limit_and_successful_send_recorded(self):
        with server.connect() as db:
            server.email(db,'guest@example.com','Test','Body');message=dict(db.execute('SELECT * FROM emails').fetchone())
        with patch('server.send_preview',return_value='resend-test') as sender:
            self.act('send-preview',message);self.act('send-preview',message);self.assertEqual(sender.call_count,1)
        with server.connect() as db:
            self.assertEqual(dashboard.email_usage(db)['daily'],1)
            for n in range(99):db.execute('INSERT INTO emails(id,recipient,subject,body,sent_id,sent_at) VALUES(?,?,?,?,?,?)',(str(n),'a@example.com','','','sent',dashboard.now()))
            with self.assertRaises(ValueError):dashboard.check_send_limit(db)
    def test_tags_and_invalid_addresses(self):
        self.act('calendar-settings',dict(tags=['Inquiry','Meditation']))
        self.act('event-options',dict(event_id='demo',tags=['Inquiry']))
        with self.assertRaises(ValueError):self.act('event-options',dict(event_id='demo',tags=['Unknown']))
        with self.assertRaises(ValueError):self.act('invite',dict(event_id='demo',emails='not-an-email'))

if __name__=='__main__':unittest.main()
