import tempfile, unittest
from pathlib import Path
import server

class BookingTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();server.DB=Path(self.tmp.name)/'test.db';server.setup()
        with server.connect() as db:db.execute("UPDATE events SET capacity=1 WHERE id='demo'")
    def tearDown(self):self.tmp.cleanup()
    def act(self,path,p):
        with server.connect() as db:
            db.execute('BEGIN IMMEDIATE');server.expire(db)
            return server.Handler.action(None,db,'/api/'+path,p)
    def register(self,address):return self.act('register',{'event_id':'demo','name':'Test','email':address})
    def test_paid_capacity_duplicate_and_cancel(self):
        first=self.register('a@example.com');self.assertEqual(first['status'],'pending')
        self.assertEqual(self.register('a@example.com')['id'],first['id'])
        self.assertEqual(self.register('b@example.com')['status'],'waitlist')
        self.act('pay',{'id':first['id']});self.act('pay',{'id':first['id']})
        with server.connect() as db:self.assertEqual(db.execute("SELECT COUNT(*) FROM emails WHERE subject LIKE 'Booking confirmed:%'").fetchone()[0],1)
        self.act('cancel',{'id':first['id']})
        self.assertEqual(self.register('c@example.com')['status'],'pending')
    def test_expired_payment_rejected(self):
        b=self.register('a@example.com')
        with server.connect() as db:db.execute("UPDATE bookings SET created='2000-01-01' WHERE id=?",(b['id'],))
        with self.assertRaises(ValueError):self.act('pay',{'id':b['id']})
        self.assertEqual(self.register('b@example.com')['status'],'pending')
    def test_event_details_round_trip(self):
        p={'id':'demo','title':'Updated','description':'Hello','starts':'2026-11-01T19:00','ends':'2026-11-01T20:00','zone':'Europe/Zurich','location':'Online','hosts':'Nico','capacity':12,'price':15,'published':True,'cover':''}
        self.act('event',p)
        with server.connect() as db:
            saved=db.execute("SELECT * FROM events WHERE id='demo'").fetchone()
            self.assertEqual(saved['ends'],p['ends'])
            self.assertEqual(saved['title'],'Updated')
        p['ends']='2026-11-01T18:00'
        with self.assertRaises(ValueError):self.act('event',p)
    def test_free_and_hidden(self):
        with server.connect() as db:db.execute("UPDATE events SET price=0 WHERE id='demo'")
        self.assertEqual(self.register('a@example.com')['status'],'confirmed')
        with server.connect() as db:db.execute("UPDATE events SET published=0 WHERE id='demo'")
        with self.assertRaises(ValueError):self.register('b@example.com')
if __name__=='__main__':unittest.main()
