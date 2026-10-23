import tempfile,unittest,io,json
from pathlib import Path
from unittest.mock import patch
import server,delivery,mailer,guest_auth

class DeliveryTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();server.DB=Path(self.tmp.name)/'test.db';server.setup()
  self.env=patch.dict('os.environ',{'EMAIL_AUTOMATIC':'test','EMAIL_DELIVERY':'test','EMAIL_TEST_ALLOWLIST':'allowed@example.com','EMAIL_TEST_RECIPIENT':'different@example.com','RESEND_API_KEY':'fake'});self.env.start()
 def tearDown(self):self.env.stop();self.tmp.cleanup()
 def queue(self,address='allowed@example.com'):
  with server.connect() as db:server.transactional_email(db,address,'Confirmation','Booking body')
 def row(self):
  with server.connect() as db:return dict(db.execute('SELECT * FROM emails ORDER BY id LIMIT 1').fetchone())
 def test_allowlist_and_old_previews_not_sent(self):
  self.queue('blocked@example.com')
  with server.connect() as db:server.email(db,'allowed@example.com','Old preview','Body')
  with patch('mailer.urlopen') as send:delivery.process_one(server.connect);send.assert_not_called()
 def test_actual_recipient_and_sent_once(self):
  self.queue()
  with patch('mailer.urlopen',return_value=io.BytesIO(b'{"id":"resend-test"}')) as send:
   delivery.process_one(server.connect);delivery.process_one(server.connect)
   self.assertEqual(send.call_count,1)
   self.assertEqual(json.loads(send.call_args.args[0].data)['to'],['allowed@example.com'])
  self.assertEqual(self.row()['delivery_status'],'accepted')
 def test_retry_uses_same_message_and_bounds(self):
  self.queue();original=self.row()['id']
  with patch('mailer.send_preview',side_effect=ValueError('Temporary failure')):
   delivery.process_one(server.connect)
   self.assertEqual(self.row()['delivery_status'],'retry')
   with server.connect() as db:db.execute("UPDATE emails SET delivery_next='',delivery_attempts=4")
   delivery.process_one(server.connect)
   self.assertEqual(self.row()['delivery_status'],'failed');self.assertEqual(self.row()['id'],original)
 def test_expired_link_is_never_sent(self):
  with server.connect() as db:
   guest_auth.request_link(db,'allowed@example.com',server.email)
   db.execute("UPDATE guest_links SET expires='2000-01-01'")
  with patch('mailer.urlopen') as send:delivery.process_one(server.connect);send.assert_not_called()
  self.assertEqual(self.row()['delivery_status'],'expired')
 def test_allowlist_removed_before_send(self):
  self.queue()
  with patch.dict('os.environ',{'EMAIL_TEST_ALLOWLIST':''}),patch('mailer.urlopen') as send:
   delivery.process_one(server.connect);send.assert_not_called()
  self.assertEqual(self.row()['delivery_status'],'blocked')
 def test_quota_stops_new_delivery(self):
  self.queue()
  with patch('delivery.check_quota',side_effect=ValueError('quota')),patch('mailer.urlopen') as send:
   delivery.process_one(server.connect);send.assert_not_called()
  self.assertEqual(self.row()['delivery_attempts'],0)
 def test_rolled_back_booking_cannot_send_email(self):
  try:
   with server.connect() as db:
    db.execute('BEGIN IMMEDIATE');server.transactional_email(db,'allowed@example.com','Cancelled transaction','Body');raise ValueError()
  except ValueError:pass
  with patch('mailer.urlopen') as send:delivery.process_one(server.connect);send.assert_not_called()
 def test_transactional_cannot_redirect_to_test_inbox(self):
  with patch('mailer.urlopen') as send:
   with self.assertRaises(ValueError):mailer.send_preview({'recipient':'blocked@example.com'},transactional=True)
   send.assert_not_called()
