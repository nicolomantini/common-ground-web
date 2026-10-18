import json, unittest, tempfile
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import server, workflows

class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();server.DB=Path(self.tmp.name)/'db';server.setup()
        with server.connect() as db:db.execute("UPDATE events SET capacity=1,starts='2099-01-01T19:00',price=0 WHERE id='demo'")
    def tearDown(self):self.tmp.cleanup()
    def act(self,path,p):
        with server.connect() as db:
            db.execute('BEGIN IMMEDIATE');server.expire(db)
            return server.Handler.action(None,db,'/api/'+path,p)
    def register(self,email='a@example.com',**kwargs):return self.act('register',{'event_id':'demo','name':'Guest','email':email,**kwargs})
    def guest(self,b,action):return self.act('guest-action',{'event_id':'demo','ids':[b['id']],'action':action})
    def test_approval_and_capacity(self):
        with server.connect() as db:db.execute("UPDATE events SET approval=1 WHERE id='demo'")
        a=self.register();b=self.register('b@example.com')
        self.assertEqual(a['status'],'approval');self.guest(a,'approve')
        with self.assertRaises(ValueError):self.guest(b,'approve')
        self.guest(a,'cancel');self.guest(b,'approve');self.guest(b,'checkin')
        with server.connect() as db:self.assertEqual(db.execute('SELECT checked_in FROM bookings WHERE id=?',(b['id'],)).fetchone()[0],1)
    def test_waitlist_promotion_paid(self):
        with server.connect() as db:db.execute("UPDATE events SET price=1500 WHERE id='demo'")
        a=self.register();b=self.register('b@example.com');self.assertEqual(b['status'],'waitlist')
        self.guest(a,'cancel');self.guest(b,'approve')
        with server.connect() as db:self.assertEqual(db.execute('SELECT status FROM bookings WHERE id=?',(b['id'],)).fetchone()[0],'pending')
        self.act('pay',{'id':b['id']})
    def test_waitlist_disabled_and_concurrent_capacity(self):
        with ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(self.register,['a@example.com','b@example.com']))
        self.assertEqual(sorted(r['status'] for r in results),['confirmed','waitlist'])
        with server.connect() as db:db.execute("UPDATE events SET waitlist=0 WHERE id='demo'")
        with self.assertRaises(ValueError):self.register('c@example.com')
    def test_required_answers_and_ticket_price_snapshot(self):
        with server.connect() as db:
            db.execute("UPDATE events SET questions=?,tickets=? WHERE id='demo'",(json.dumps([{'id':'q','label':'Why join?','required':True}]),json.dumps([{'id':'t','name':'Supporter','price':2500,'capacity':2}])))
        with self.assertRaises(ValueError):self.register(ticket_id='t')
        b=self.register(ticket_id='t',answers={'q':'To learn'})
        self.assertEqual(b['amount'],2500);self.assertEqual(json.loads(b['answers'])[0]['answer'],'To learn')
    def test_duplicate_and_cancel_preserve_original(self):
        b=self.register();copy=self.act('duplicate',{'event_id':'demo'})
        with server.connect() as db:
            self.assertEqual(db.execute('SELECT published FROM events WHERE id=?',(copy['id'],)).fetchone()[0],0)
            self.assertEqual(db.execute('SELECT COUNT(*) FROM bookings WHERE event_id=?',(copy['id'],)).fetchone()[0],0)
        self.act('cancel-event',{'event_id':'demo'})
        with self.assertRaises(ValueError):self.register('b@example.com')
        with server.connect() as db:self.assertEqual(db.execute('SELECT status FROM bookings WHERE id=?',(b['id'],)).fetchone()[0],'cancelled')
    def test_blast_is_preview_only(self):
        self.register();result=self.act('blast',{'event_id':'demo','subject':'Welcome','body':'See you soon','status':'confirmed'})
        self.assertEqual(result['count'],1)
        with server.connect() as db:self.assertEqual(db.execute("SELECT sent_id FROM emails WHERE subject='Welcome'").fetchone()[0],'')
    def test_calendar_timezone_and_escaping(self):
        with server.connect() as db:
            db.execute("UPDATE events SET starts='2026-10-24T19:00',ends='2026-10-24T20:00',title=? WHERE id='demo'",('Test, with\nnewline',))
            result=workflows.calendar(db.execute("SELECT * FROM events WHERE id='demo'").fetchone())
        self.assertIn('DTSTART:20261024T170000Z',result)
        self.assertIn('SUMMARY:Test\\, with\\nnewline',result)
        self.assertTrue(all(len(line.encode())<=75 for line in result.split('\r\n')))
