import unittest,tempfile,json
from pathlib import Path
from datetime import datetime,timezone,timedelta
from unittest.mock import patch
import server,refunds,payments,workflows
class RefundTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();server.DB=Path(self.tmp.name)/'db';server.setup()
  self.at=datetime(2026,10,23,10,tzinfo=timezone.utc)
  with server.connect() as db:
   db.execute("UPDATE events SET starts='2026-10-25T11:00',zone='Europe/Zurich' WHERE id='demo'")
   db.execute("INSERT INTO bookings(id,event_id,name,email,status,amount,created) VALUES('b','demo','Guest','guest@example.com','confirmed',1500,'2026-10-01')")
  self.s={'payment_status':'paid','payment_intent':'pi_test','livemode':False}
 def tearDown(self):self.tmp.cleanup()
 def cancel(self,event=False):
  with server.connect() as db,patch('payments.before_cancel',return_value=self.s),patch('refunds.now',return_value=self.at):
   b=db.execute("SELECT * FROM bookings WHERE id='b'").fetchone();workflows.transition(db,b,'cancel',server.email,event_cancelled=event)
 def status(self):
  with server.connect() as db:return db.execute("SELECT refund_status FROM bookings WHERE id='b'").fetchone()[0]
 def test_exact_48_hours_with_dst(self):
  # Zurich changed from UTC+2 to UTC+1 that morning: start is 10 UTC.
  self.cancel();self.assertEqual(self.status(),'queued')
 def test_under_48_hours_no_refund(self):
  self.at+=timedelta(seconds=1);self.cancel();self.assertEqual(self.status(),'not_eligible')
 def test_host_event_cancellation_always_refunds(self):
  self.at+=timedelta(days=3);self.cancel(event=True);self.assertEqual(self.status(),'queued')
 def test_event_cancel_upgrades_late_guest_cancel(self):
  self.at+=timedelta(hours=1);self.cancel();self.cancel(event=True);self.assertEqual(self.status(),'queued')
 def test_repeated_cancel_queues_one_refund(self):
  self.cancel();self.cancel()
  with server.connect() as db:self.assertEqual(db.execute('SELECT count(*) FROM refund_jobs').fetchone()[0],1)
 def test_unpaid_cancellation_no_refund(self):
  self.s=None;self.cancel();self.assertEqual(self.status(),'')
 def run_worker(self,status='succeeded'):
  response={'id':'re_test','payment_intent':'pi_test','amount':1500,'currency':'eur','status':status}
  with patch('payments.enabled',return_value=True),patch('refunds.now',return_value=self.at),patch('payments.api',side_effect=[{'livemode':False,'currency':'eur','amount_received':1500},response]) as api:
   refunds.process_one(server.connect,server.email)
   self.assertEqual(api.call_args.args[2],'cg-full-refund-b')
 def test_success_and_no_duplicate(self):
  self.cancel();self.run_worker();self.assertEqual(self.status(),'succeeded')
  with patch('payments.enabled',return_value=True),patch('payments.api') as api:refunds.process_one(server.connect,server.email);api.assert_not_called()
 def test_pending_is_not_reported_as_refunded(self):
  self.cancel();self.run_worker('pending');self.assertEqual(self.status(),'pending')
 def test_failure_retries_without_undoing_cancellation(self):
  self.cancel()
  with patch('payments.enabled',return_value=True),patch('refunds.now',return_value=self.at),patch('payments.api',side_effect=ValueError('Unavailable')):refunds.process_one(server.connect,server.email)
  self.assertEqual(self.status(),'retry')
 def test_rollback_never_requests_refund(self):
  try:
   with server.connect() as db:
    db.execute('BEGIN IMMEDIATE');b=db.execute("SELECT * FROM bookings WHERE id='b'").fetchone();e=db.execute("SELECT * FROM events WHERE id='demo'").fetchone();refunds.queue(db,b,e,self.s,True,self.at);raise ValueError()
  except ValueError:pass
  with server.connect() as db:self.assertEqual(db.execute('SELECT count(*) FROM refund_jobs').fetchone()[0],0)
