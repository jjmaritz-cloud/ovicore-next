"""Isolated SQLite integration of actual BMP route bodies; no live DB or app startup.
PostgreSQL row locking and full ASGI auth are tested separately in sandbox.
"""
import ast
import os
from pathlib import Path
from types import SimpleNamespace
from datetime import date, datetime
import unittest

# Explicit isolation even when developer machine has a production .env.
os.environ['DATABASE_URL'] = 'sqlite:///:memory:'
from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from fastapi import HTTPException, Depends
from app import models, schemas, bmp_activities as bmp_ops
from app.db import Base

APP = Path(__file__).resolve().parents[1] / 'app'
TODAY = date(2026,11,28)


def extract(filename, names, namespace):
    tree = ast.parse(filename.read_text(encoding='utf-8'))
    nodes = [node for node in tree.body if isinstance(node, ast.FunctionDef) and node.name in names]
    assert set(names) == {node.name for node in nodes}
    for node in nodes:
        node.decorator_list = []
    exec(compile(ast.Module(body=nodes, type_ignores=[]), str(filename), 'exec'), namespace)


def api_namespace():
    ns = dict(models=models, schemas=schemas, bmp_ops=bmp_ops, Company=models.Company,
              BroilerFarm=models.BroilerFarm, Session=Session, HTTPException=HTTPException,
              Depends=Depends, get_current_user=lambda:None, get_db=lambda:None,
              bmp_today=lambda:TODAY, datetime=datetime,
              BMP_MODULES={'Commercial Rearing':'enable_layers','Commercial Layers':'enable_layers'},
              LAYER_BMP_TYPES={'rearing':(models.LayerRearingFlock,'Commercial Rearing','layer_rearing'),
                               'commercial':(models.CommercialLayerFlock,'Commercial Layers','commercial_layers')})
    access_ns = dict(models=models, Session=Session)
    extract(APP/'routers'/'access.py', ['user_has_farm_access'], access_ns)
    ns['access'] = SimpleNamespace(user_has_farm_access=access_ns['user_has_farm_access'])
    extract(APP/'main.py', ['bmp_company','validate_bmp_assignment','set_layer_bmp','layer_bmp_target',
             'layer_bmp_assign','bmp_operational_open','bmp_actor','bmp_auto_sync','bmp_activity_response',
             'bmp_action_centre','bmp_sync_layer','bmp_complete_layer'],ns)
    return ns


class ActionCentreTest(unittest.TestCase):
    def setUp(self):
        self.engine = create_engine('sqlite:///:memory:')
        Base.metadata.create_all(self.engine)
        self.db = Session(self.engine)
        self.api = api_namespace()
        self.db.add_all([models.Company(id=i,company_name=f'Company {i}',enable_layers=True,active=True) for i in [1,2]])
        self.db.add_all([models.AppUser(id=1,company_id=1,full_name='Admin',email='admin@example.test',is_company_admin=True),
                         models.AppUser(id=2,company_id=1,full_name='Farm account',email='farm@example.test'),
                         models.AppUser(id=3,company_id=2,full_name='Other tenant',email='other@example.test'),
                         models.AppUser(id=4,company_id=None,full_name='Global',email='global@example.test',is_global_admin=True)])
        self.db.flush()
        for farm_id,company_id,kind in [(1,1,'layer_rearing'),(2,1,'commercial_layers'),(3,2,'layer_rearing'),(4,1,'layer_rearing')]:
            self.db.add(models.BroilerFarm(id=farm_id,company_id=company_id,farm_name=f'Farm {farm_id}',farm_type=kind,active=True))
            self.db.add(models.BroilerShed(id=farm_id,company_id=company_id,farm_id=farm_id,shed_name=f'Shed {farm_id}',floor_area_m2=100))
        self.db.add(models.UserFarmAccess(user_id=2,farm_id=1))
        # Erroneous cross-tenant farm membership must not confer access.
        self.db.add(models.UserFarmAccess(user_id=2,farm_id=3))
        self.db.add(models.UserFarmAccess(user_id=3,farm_id=3))
        tasks=[dict(title='Historical',category='management',age_day=1),dict(title='Due',category='management',age_day=7),dict(title='Upcoming',category='management',age_day=8)]
        self.snapshot={'id':1,'name':'Test','version':1,'family_key':'family','production_type':'Commercial Rearing','tasks':tasks,'effective_date':None,'change_summary':None}
        self.db.add(models.BMPVersion(id=1,company_id=1,family_key='family',version=1,production_type='Commercial Rearing',name='Test',status='Approved',tasks=tasks,created_by='Admin'))
        self.db.add(models.BMPVersion(id=2,company_id=1,family_key='family',version=2,production_type='Commercial Rearing',name='Test',status='Approved',tasks=tasks+[dict(title='Next',category='management',age_day=9)],created_by='Admin'))
        for i,c,f,status in [(1,1,1,'Active'),(3,2,3,'Active'),(4,1,4,'Active'),(5,1,1,'Draft'),(6,1,1,'Transferred')]:
            self.db.add(models.LayerRearingFlock(id=i,company_id=c,farm_id=f,shed_id=f,flock_code=f'LR-{i}',status=status,hatch_date=date(2026,11,21),bmp_snapshot=self.snapshot if i!=1 else None))
        self.db.add(models.CommercialLayerFlock(id=2,company_id=1,farm_id=2,shed_id=2,flock_code='CL-2',status='Active',hatch_date=date(2026,11,21),bmp_snapshot={**self.snapshot,'production_type':'Commercial Layers'}))
        self.db.commit()
        self.admin=self.db.get(models.AppUser,1);self.farm=self.db.get(models.AppUser,2);self.other=self.db.get(models.AppUser,3);self.glob=self.db.get(models.AppUser,4)
    def tearDown(self):
        self.db.close();self.engine.dispose()
    def centre(self,user,company=1):
        return self.api['bmp_action_centre'](company,user,self.db)
    def assign(self,version,expected,user=None):
        return self.api['layer_bmp_assign']('rearing',1,1,schemas.LayerBMPAssignmentIn(version_id=version,expected_version_id=expected,reason='Test'),user or self.admin,self.db)
    def test_automatic_assignment_and_scope(self):
        self.assign(1,None)
        state=self.db.get(models.LayerRearingFlock,1).bmp_activity_state
        self.assertEqual(len(state['records']),2)
        a=self.centre(self.farm); b=self.centre(self.farm)
        self.assertEqual([i['id'] for i in a['items']],[i['id'] for i in b['items']])
        self.assertEqual({i['flock_code'] for i in a['items']},{'LR-1'})
        self.assertEqual({i['display_status'] for i in a['items']},{'due','upcoming'})
        self.assertEqual({i['flock_code'] for i in self.centre(self.admin)['items']},{'LR-1','LR-4','CL-2'})
        self.assertEqual({i['flock_code'] for i in self.centre(self.glob,2)['items']},{'LR-3'})
        with self.assertRaises(HTTPException) as err:self.centre(self.farm,2)
        self.assertEqual(err.exception.status_code,403)
        with self.assertRaises(HTTPException) as err:self.assign(2,1,self.farm)
        self.assertEqual(err.exception.status_code,403)
    def test_completion_reconciliation_and_history(self):
        self.assign(1,None)
        item=next(i for i in self.centre(self.farm)['items'] if i['display_status']=='due')
        payload=schemas.BMPActivityCompletionIn(activity_id=item['id'],actual_date=TODAY,confirmed=True,comments='Test completion')
        with self.assertRaises(HTTPException) as err:self.api['bmp_complete_layer']('rearing',1,1,payload,self.other,self.db)
        self.assertEqual(err.exception.status_code,403)
        self.db.rollback()
        self.api['bmp_complete_layer']('rearing',1,1,payload,self.farm,self.db)
        self.assign(2,1)
        flock=self.db.get(models.LayerRearingFlock,1)
        records=flock.bmp_activity_state['records']; completed=[r for r in records if r['status']=='completed']
        self.assertEqual(len(completed),1);self.assertEqual(completed[0]['signed_by']['user_id'],2);self.assertEqual(completed[0]['comments'],'Test completion')
        self.assertEqual(len(flock.bmp_assignment_history),2)
        self.assertEqual({r['title'] for r in self.centre(self.farm)['items']},{'Upcoming','Next'})
    def test_legacy_first_sync_and_closed(self):
        # Existing assigned but unactivated flock syncs once, skips historical activity.
        a=self.centre(self.admin); b=self.centre(self.admin)
        self.assertEqual([i['id'] for i in a['items']],[i['id'] for i in b['items']])
        self.assertNotIn('Historical',[i['title'] for i in a['items']])
        self.assertIsNone(self.db.get(models.LayerRearingFlock,5).bmp_activity_state)
        self.assertIsNone(self.db.get(models.LayerRearingFlock,6).bmp_activity_state)
        f=self.db.get(models.CommercialLayerFlock,2);f.status='Depleted';self.db.commit()
        self.assertNotIn('CL-2',{i['flock_code'] for i in self.centre(self.admin)['items']})
        self.assertTrue(f.bmp_activity_state['records'])

if __name__=='__main__': unittest.main()
