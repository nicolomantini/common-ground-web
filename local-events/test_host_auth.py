import tempfile,unittest,json
from pathlib import Path
import server,host_auth,guest_auth,dashboard

class HostAccessTests(unittest.TestCase):
 def setUp(self):
  self.tmp=tempfile.TemporaryDirectory();server.DB=Path(self.tmp.name)/'test.db';server.setup()
  with server.connect() as db:
   for email,pid,admin in [('admin@example.com','',1),('one@example.com','one',0),('two@example.com','two',0)]:
    db.execute('INSERT INTO practitioners VALUES(?,?,?)',(pid or 'admin',email,''))
    db.execute('INSERT INTO host_accounts VALUES(?,?,?,?,1)',(email,pid,admin,host_auth.password_hash('test-password-long')))
   db.execute("UPDATE events SET host_ids=?,location_type='online',location='https://example.com/private' WHERE id='demo'",(json.dumps(['one']),))
   self.one=host_auth.cookie(host_auth.login(db,{'email':'one@example.com','password':'test-password-long'})['token'])
   self.two=host_auth.cookie(host_auth.login(db,{'email':'two@example.com','password':'test-password-long'})['token'])
   self.admin=host_auth.cookie(host_auth.login(db,{'email':'admin@example.com','password':'test-password-long'})['token'])
 def tearDown(self):self.tmp.cleanup()
 def test_event_permissions_and_self_assignment(self):
  with server.connect() as db:
   host_auth.authorize(db,'/api/event-options',{'event_id':'demo'},self.one)
   host_auth.authorize(db,'/api/event-options',{'event_id':'demo'},self.admin)
   for header in ['',self.two]:
    with self.assertRaises(PermissionError):host_auth.authorize(db,'/api/event-options',{'event_id':'demo'},header)
   with self.assertRaises(PermissionError):host_auth.authorize(db,'/api/event',{'id':'demo','host_ids':['two']},self.one)
   host_auth.authorize(db,'/api/event',{'host_ids':['one']},self.one)
 def test_admin_only_routes(self):
  with server.connect() as db:
   for route in ['host-account','calendar-settings','contact','voucher','send-preview']:
    with self.assertRaises(PermissionError):host_auth.authorize(db,'/api/'+route,{},self.one)
    host_auth.authorize(db,'/api/'+route,{},self.admin)
 def test_account_disable_revokes_sessions(self):
  with server.connect() as db:
   host_auth.manage_account(db,{'email':'one@example.com','practitioner_id':'one','active':False})
   self.assertIsNone(host_auth.identity(db,self.one))
 def test_guest_cannot_register_as_someone_else(self):
  with server.connect() as db:
   db.execute('INSERT INTO guest_sessions VALUES(?,?,?)',(guest_auth.digest('guest'),'guest@example.com','2999-01-01'))
   header=guest_auth.session_cookie('guest')
   host_auth.authorize(db,'/api/register',{'email':'guest@example.com'},header)
   with self.assertRaises(PermissionError):host_auth.authorize(db,'/api/register',{'email':'other@example.com'},header)
   with self.assertRaises(PermissionError):host_auth.authorize(db,'/api/register',{'email':'guest@example.com'},'')
 def test_private_state_and_meeting_link_hidden(self):
  with server.connect() as db:
   def state():return {**{t:[dict(r) for r in db.execute('SELECT * FROM '+t)] for t in ['events','bookings','emails']},**dashboard.snapshot(db)}
   with self.assertRaises(PermissionError):host_auth.filter_state(db,state(),'')
   public=host_auth.filter_state(db,state(),'',True)
   self.assertEqual(public['events'][0]['location'],'');self.assertEqual(public['emails'],[])
   self.assertEqual(host_auth.filter_state(db,state(),self.two)['events'],[])
 def test_login_rate_limit_and_expiry(self):
  with server.connect() as db:
   for _ in range(5):host_auth.login(db,{'email':'two@example.com','password':'wrong-password'})
   self.assertIn('Too many',host_auth.login(db,{'email':'two@example.com','password':'test-password-long'})['error'])
   db.execute("UPDATE host_sessions SET expires='2000-01-01'")
   self.assertIsNone(host_auth.identity(db,self.one))
 def test_other_guest_booking_rejected(self):
  with server.connect() as db:
   db.execute("INSERT INTO bookings(id,event_id,name,email,status,created) VALUES('private','demo','Guest','other@example.com','confirmed','2026-10-23')")
   db.execute('INSERT INTO guest_sessions VALUES(?,?,?)',(guest_auth.digest('guest'),'guest@example.com','2999-01-01'))
   for route in ['pay','cancel','feedback']:
    with self.assertRaises(PermissionError):host_auth.authorize(db,'/api/'+route,{'id':'private','booking_id':'private'},guest_auth.session_cookie('guest'))
 def test_campaign_reassignment_rejected(self):
  with server.connect() as db:
   db.execute("INSERT INTO campaigns VALUES('c','demo','Subject','Body','all','draft','','')")
   with self.assertRaises(PermissionError):host_auth.authorize(db,'/api/campaign',{'id':'c','event_id':'other'},self.one)
   with self.assertRaises(PermissionError):host_auth.authorize(db,'/api/campaign-queue',{'id':'c'},self.two)
