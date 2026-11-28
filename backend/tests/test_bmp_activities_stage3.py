import unittest
from datetime import date
from app.bmp_activities import activate, complete

class ActivitiesTest(unittest.TestCase):
    def test_activation_and_history(self):
        hatch=date(2026,1,1); today=date(2026,1,8); actor={'user_id':1,'account_name':'Test'}
        tasks=[dict(title='Historical',category='management',age_day=1),dict(title='Weigh',category='management',age_day=7),dict(title='Lighting',category='lighting',age_day=20),dict(title='Recurring',category='management',age_day=5,end_age_day=11,interval_days=2,schedule_type='recurring'),dict(title='Optional',category='management',age_day=7,requires_signoff=False)]
        s=activate(dict(id=1,version=1,tasks=tasks),hatch,today,None,actor,'time')
        self.assertEqual(len(s['records']),5)
        self.assertNotIn('Historical',[r['title'] for r in s['records']])
        self.assertEqual(s,activate(dict(id=1,version=1,tasks=tasks),hatch,today,s,actor,'time'))
        record=next(r for r in s['records'] if r['title']=='Weigh')
        with self.assertRaises(ValueError): complete(s,record['id'],date(2026,1,9),today,actor,'time','')
        s=complete(s,record['id'],today,today,actor,'time','done')
        with self.assertRaises(ValueError): complete(s,record['id'],today,today,actor,'time','')
        revised=[{**t,'age_day':9} if t['title']=='Weigh' else t for t in tasks]
        s2=activate(dict(id=2,version=2,tasks=revised),hatch,today,s,actor,'time2')
        self.assertEqual(len([r for r in s2['records'] if r['title']=='Weigh']),1)
        self.assertEqual(next(r for r in s2['records'] if r['title']=='Weigh')['status'],'completed')
        self.assertEqual(len([r for r in s2['records'] if r['title']=='Lighting' and r['status']=='pending']),1)
    def test_range(self):
        s=activate(dict(id=1,version=1,tasks=[dict(title='Window',category='management',age_day=1,end_age_day=10,schedule_type='range')]),date(2026,1,1),date(2026,1,5),None,{},'time')
        self.assertEqual(s['records'][0]['due_date'],'2026-01-11')

if __name__=='__main__': unittest.main()
