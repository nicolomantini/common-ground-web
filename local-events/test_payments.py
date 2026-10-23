import unittest,tempfile,json
from pathlib import Path
from unittest.mock import patch
import server,payments,workflows
class PaymentTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();server.DB=Path(self.tmp.name)/'db';server.setup()
  with server.connect() as db:
   db.execute("UPDATE events SET starts='2099-01-01T19:00' WHERE id='demo'")
   self.b=workflows.register(db,db.execute("SELECT * FROM events WHERE id='demo'").fetchone(),{'name':'Test','email':'test@example.com'},server.email)
   payments.prepare(db,self.b['id'])
 def tearDown(self):self.tmp.cleanup()
 def state(self):
  with server.connect() as db:return db.execute('SELECT status FROM bookings WHERE id=?',(self.b['id'],)).fetchone()[0]
 def session(self,**extra):return {'id':'cs_test_unit','livemode':False,'status':'complete','payment_status':'paid','amount_total':self.b['amount'],'currency':'eur','client_reference_id':self.b['id'],'metadata':{'booking_id':self.b['id']},**extra}
 def test_paid_verified_once(self):
  with patch('payments.api',return_value=self.session()):
   payments.checkout(server.connect,self.b['id'],server.email);payments.checkout(server.connect,self.b['id'],server.email)
  self.assertEqual(self.state(),'confirmed')
  with server.connect() as db:self.assertEqual(db.execute('SELECT count(*) FROM emails').fetchone()[0],1)
 def test_amount_currency_and_mode_mismatch_rejected(self):
  for extra in [{'amount_total':1},{'currency':'usd'},{'livemode':True},{'client_reference_id':'someone-else'}]:
   with patch('payments.api',return_value=self.session(**extra)),self.assertRaises(ValueError):payments.checkout(server.connect,self.b['id'],server.email)
   self.assertEqual(self.state(),'pending')
 def test_unpaid_never_confirms_and_expired_releases(self):
  with patch('payments.api',return_value=self.session(payment_status='unpaid',status='open',url='https://checkout.stripe.com/test')):self.assertIn('url',payments.checkout(server.connect,self.b['id'],server.email))
  self.assertEqual(self.state(),'pending')
  with patch('payments.api',return_value=self.session(payment_status='unpaid',status='expired')):payments.checkout(server.connect,self.b['id'],server.email)
  self.assertEqual(self.state(),'expired')
 def test_checkout_hold_not_expired_locally(self):
  with server.connect() as db:
   db.execute("UPDATE bookings SET created='2000-01-01'");server.expire(db)
  self.assertEqual(self.state(),'pending')
 def test_payload_uses_saved_amount_and_stable_idempotency(self):
  with patch('payments.api',return_value=self.session(status='open',payment_status='unpaid',url='https://checkout.stripe.com/test')) as api:
   payments.checkout(server.connect,self.b['id'],server.email)
   args=api.call_args.args;self.assertEqual(args[1]['line_items[0][price_data][unit_amount]'],str(self.b['amount']));self.assertEqual(args[2],'cg-checkout-'+self.b['id'])
 def test_fake_host_payment_action_rejected(self):
  with server.connect() as db,self.assertRaises(ValueError):workflows.action(db,'/api/guest-action',{'event_id':'demo','ids':[self.b['id']],'action':'pay'},server.email)
 def test_disabled_stripe_cannot_simulate_payment(self):
  with patch('payments.enabled',return_value=False),server.connect() as db,self.assertRaises(ValueError):server.Handler.action(None,db,'/api/pay',{'id':self.b['id']})
 def test_cancellation_expires_checkout_first(self):
  with server.connect() as db,patch('payments.api',side_effect=[self.session(status='open',payment_status='unpaid'),self.session(status='expired',payment_status='unpaid')]) as api:
   workflows.transition(db,db.execute('SELECT * FROM bookings WHERE id=?',(self.b['id'],)).fetchone(),'cancel',server.email)
   self.assertTrue(api.call_args.args[0].endswith('/expire'))
  self.assertEqual(self.state(),'cancelled')
