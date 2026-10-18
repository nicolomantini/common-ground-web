import json,unittest,tempfile
from pathlib import Path
from unittest.mock import patch
import server,practitioners
class SettingsTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();server.DB=Path(self.tmp.name)/'db';server.setup()
        self.people=patch('practitioners.get_practitioners',return_value=[{'id':'person-1','name':'Real Practitioner','photo':None}]);self.people.start()
    def tearDown(self):self.people.stop();self.tmp.cleanup()
    def act(self,path,p):
        with server.connect() as db:
            db.execute('BEGIN IMMEDIATE');server.expire(db)
            return server.Handler.action(None,db,'/api/'+path,p)
    def payload(self):return {'title':'Donation event','description':'Test','starts':'2099-01-01T19:00','ends':'','zone':'Europe/Zurich','location':'https://zoom.us/j/123','location_type':'online','host_ids':['person-1'],'capacity':12,'price':15,'published':True,'pricing_mode':'donation','donation_min':'0','donation_suggested':'15','donation_max':'30'}
    def test_hosts_and_online_link(self):
        p=self.payload();eid=self.act('event',p)['id']
        with server.connect() as db:
            e=db.execute('SELECT * FROM events WHERE id=?',(eid,)).fetchone();self.assertEqual(e['hosts'],'Real Practitioner');self.assertEqual(json.loads(e['host_ids']),['person-1']);self.assertEqual(e['location_type'],'online')
        p['host_ids']=['unknown']
        with self.assertRaises(ValueError):self.act('event',p)
        p=self.payload();p['location']='javascript:alert(1)'
        with self.assertRaises(ValueError):self.act('event',p)
        p['location_type']='in_person';p['location']='A venue in Zurich';self.act('event',p)
    def test_contribution_amount_validation(self):
        eid=self.act('event',self.payload())['id']
        def register(n,amount):return self.act('register',{'event_id':eid,'name':'Guest','email':f'{n}@example.com','contribution':amount})
        free=register('free','0');self.assertEqual(free['status'],'confirmed');self.assertEqual(free['amount'],0)
        paid=register('paid','12.34');self.assertEqual(paid['amount'],1234);self.assertEqual(paid['status'],'pending')
        for amount in ['-1','31','0.10','10.001','NaN']:
            with self.assertRaises(ValueError):register('invalid',amount)
    def test_range_validation_and_price_snapshot(self):
        p=self.payload();p['donation_min']='20'
        with self.assertRaises(ValueError):self.act('event',p)
        p=self.payload();eid=self.act('event',p)['id'];b=self.act('register',{'event_id':eid,'name':'Guest','email':'one@example.com','contribution':'12'})
        p.update(id=eid,donation_min='20',donation_suggested='25');self.act('event',p)
        with server.connect() as db:self.assertEqual(db.execute('SELECT amount FROM bookings WHERE id=?',(b['id'],)).fetchone()[0],1200)
