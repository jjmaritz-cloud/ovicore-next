"""Approved, editable Intelligence synonym packs. SQL persisted, Global Admin only.

Only maps exact phrases to existing supported metrics. Never executes instructions or SQL
supplied in training packages. App permissions remain enforced by the /ask endpoint.
"""
import json
import re
from datetime import datetime, timezone
from sqlalchemy import text
from fastapi import HTTPException
from app.routers.intelligence_rules import SUPPORTED_METRICS

TABLE = "ovicore_intelligence_rule_packs"

def ensure_table(db):
    # Uses the existing app DB, not container-local files (which may be ephemeral).
    db.execute(text("""CREATE TABLE IF NOT EXISTS ovicore_intelligence_rule_packs (
        id INTEGER PRIMARY KEY, name VARCHAR(100) NOT NULL, rules_json TEXT NOT NULL,
        created_by INTEGER NOT NULL, created_at VARCHAR(40) NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1)"""))
    db.commit()

def validate_pack(raw):
    if not isinstance(raw, dict) or set(raw) != {"version", "name", "rules"}:
        raise HTTPException(422, "Package needs exactly: version, name, rules.")
    if raw['version'] != 1 or not isinstance(raw['name'],str) or not 3 <= len(raw['name'].strip()) <= 100:
        raise HTTPException(422, "Use version 1 and a name between 3 and 100 characters.")
    rules=raw['rules']
    if not isinstance(rules,list) or not 1 <= len(rules) <= 100:
        raise HTTPException(422, "Provide 1 to 100 rules per pack.")
    seen=set();clean=[]
    for i, rule in enumerate(rules,1):
        if not isinstance(rule,dict) or set(rule) != {'phrase','metric'}:
            raise HTTPException(422,f"Rule {i}: only phrase and metric are allowed.")
        phrase=rule['phrase'];metric=rule['metric']
        if not isinstance(phrase,str) or not 2<=len(phrase.strip())<=80 or not re.fullmatch(r"[\w %./\-]+",phrase.strip(),re.UNICODE):
            raise HTTPException(422,f"Rule {i}: phrase must be 2–80 plain characters.")
        if metric not in SUPPORTED_METRICS:
            raise HTTPException(422,f"Rule {i}: metric '{metric}' is not connected. Supported: {', '.join(sorted(SUPPORTED_METRICS))}.")
        norm=' '.join(phrase.casefold().split())
        if norm in seen:raise HTTPException(422,f"Duplicate phrase: {phrase}")
        seen.add(norm);clean.append({'phrase':norm,'metric':metric})
    return {'version':1,'name':raw['name'].strip(),'rules':clean}

def packs(db):
    ensure_table(db)
    result=db.execute(text('SELECT id,name,rules_json,created_by,created_at,enabled FROM ovicore_intelligence_rule_packs ORDER BY id DESC')).mappings().all()
    return [{'id':r['id'],'name':r['name'],'rules':json.loads(r['rules_json'])['rules'],
             'created_by':r['created_by'],'created_at':r['created_at'],'enabled':bool(r['enabled'])} for r in result]

def active_rules(db):
    # Latest pack wins in conflicts. Disabled packs are reversible.
    mapping={}
    for pack in reversed(packs(db)):
        if pack['enabled']:
            for rule in pack['rules']:mapping[rule['phrase']]=rule['metric']
    return [{'phrase':phrase,'metric':metric} for phrase,metric in mapping.items()]

def add_pack(db,data,user_id):
    clean=validate_pack(data);ensure_table(db)
    # IDs allocated from existing max, portable across SQLite/PostgreSQL.
    next_id=db.execute(text('SELECT COALESCE(MAX(id),0)+1 FROM ovicore_intelligence_rule_packs')).scalar()
    db.execute(text('INSERT INTO ovicore_intelligence_rule_packs (id,name,rules_json,created_by,created_at,enabled) VALUES (:id,:name,:raw,:uid,:created,1)'),
        {'id':next_id,'name':clean['name'],'raw':json.dumps(clean),'uid':user_id,'created':datetime.now(timezone.utc).isoformat()})
    db.commit()
    return next_id

def set_pack_enabled(db,pack_id,enabled):
    ensure_table(db)
    existing=db.execute(text('SELECT id FROM ovicore_intelligence_rule_packs WHERE id=:id'),{'id':pack_id}).scalar()
    if existing is None:raise HTTPException(404,'Training pack not found')
    db.execute(text('UPDATE ovicore_intelligence_rule_packs SET enabled=:enabled WHERE id=:id'),{'id':pack_id,'enabled':int(enabled)})
    db.commit()
