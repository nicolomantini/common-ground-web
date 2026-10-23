import unittest,tempfile
from pathlib import Path
from datetime import timedelta
import server,guest_auth

class GuestAuthTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();server.DB=Path(self.tmp.name)/'db';server.setup();self.messages=[]
    def tearDown(self):self.tmp.cleanup()
    def email(self,db,recipient,subject,body):self.messages.append(body)
    def token(self):return self.messages[-1].split('#token=')[1].split('\n')[0]
    def test_single_use_and_cookie(self):
        with server.connect() as db:
            guest_auth.request_link(db,' Guest@example.com ',self.email)
            token=self.token();session=guest_auth.consume(db,token)
            self.assertEqual(guest_auth.identity(db,'cg_guest='+session),'guest@example.com')
            with self.assertRaises(ValueError):guest_auth.consume(db,token)
            cookie=guest_auth.session_cookie(session)
            self.assertIn('HttpOnly',cookie);self.assertIn('SameSite=Strict',cookie)
            guest_auth.logout(db,'cg_guest='+session)
            with self.assertRaises(PermissionError):guest_auth.identity(db,'cg_guest='+session)
    def test_expiry_and_throttling(self):
        with server.connect() as db:
            guest_auth.request_link(db,'guest@example.com',self.email)
            guest_auth.request_link(db,'guest@example.com',self.email)
            self.assertEqual(len(self.messages),1)
            db.execute("UPDATE guest_links SET expires='2000-01-01'")
            with self.assertRaises(ValueError):guest_auth.consume(db,self.token())
            with self.assertRaises(PermissionError):guest_auth.identity(db,'cg_guest=made-up')
    def test_guest_isolation_and_cancellation(self):
        with server.connect() as db:
            db.execute("UPDATE events SET starts='2099-01-01T10:00',price=0 WHERE id='demo'")
            a=server.Handler.action(None,db,'/api/register',dict(event_id='demo',name='A',email='a@example.com'))
            b=server.Handler.action(None,db,'/api/register',dict(event_id='demo',name='B',email='b@example.com'))
            own=guest_auth.bookings(db,'a@example.com')['bookings']
            self.assertEqual([x['id'] for x in own],[a['id']])
            with self.assertRaises(ValueError):guest_auth.cancel(db,'a@example.com',b['id'],self.email)
            guest_auth.cancel(db,'a@example.com',a['id'],self.email)
            self.assertEqual(guest_auth.bookings(db,'a@example.com')['bookings'][0]['status'],'cancelled')
            self.assertEqual(guest_auth.bookings(db,'b@example.com')['bookings'][0]['status'],'confirmed')
    def test_pending_location_hidden_and_expired_session(self):
        with server.connect() as db:
            db.execute("UPDATE events SET starts='2099-01-01T10:00' WHERE id='demo'")
            server.Handler.action(None,db,'/api/register',dict(event_id='demo',name='A',email='a@example.com'))
            self.assertEqual(guest_auth.bookings(db,'a@example.com')['bookings'][0]['location'],'')
            guest_auth.request_link(db,'a@example.com',self.email);session=guest_auth.consume(db,self.token())
            db.execute("UPDATE guest_sessions SET expires='2000-01-01'")
            with self.assertRaises(PermissionError):guest_auth.identity(db,'cg_guest='+session)
