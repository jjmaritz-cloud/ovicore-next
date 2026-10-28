"""Deterministic, reviewed poultry-language interpretation. No remote model.

Knowledge data is versioned beside app source, and contains no executable SQL.
Only metrics exposed by the API are eligible for execution.
"""
from functools import lru_cache
from pathlib import Path
import json
import re

_RULE_PATH = Path(__file__).resolve().parent.parent / 'intelligence' / 'layers_rules.json'
SUPPORTED_METRICS = {'opening_birds','closing_birds','mortality_birds','mortality_pct',
                     'production_pct','feed_g_bird_day','water_ml_bird_day','fcr_kg_dozen','bodyweight_g'}

@lru_cache(maxsize=1)
def load_rules():
    data = json.loads(_RULE_PATH.read_text(encoding='utf-8'))
    if data.get('schema_version') != 1 or data.get('model_api_required') is not False:
        raise ValueError('Unsupported Intelligence rule library')
    return data

def _matched(text, phrase):
    # Whole-token matching prevents e.g. "mort" matching an unrelated word.
    return bool(re.search(r'(?<!\w)' + re.escape(phrase.casefold()) + r'(?!\w)', text))

def interpret(question, custom_rules=None):
    q = question.casefold()
    matches = []
    for entry in load_rules()['metric_dictionary']:
        metric = entry.get('id')
        if metric not in SUPPORTED_METRICS or entry.get('status') != 'supported':
            continue
        for term in entry.get('synonyms', []):
            if _matched(q, term):
                matches.append((len(term), metric, term))
    for entry in custom_rules or []:
        if _matched(q, entry["phrase"]):
            matches.append((1000 + len(entry["phrase"]), entry["metric"], entry["phrase"]))
    matches.sort(reverse=True)
    metric = matches[0][1] if matches else None
    # Resolve frequent competing expressions using explicit safety precedence.
    mortality = bool(re.search(r'\bmort(?:s|ality|alities)?\b|\bdead\b|\bdeath|\bdied\b', q))
    if mortality:
        metric = 'mortality_pct' if re.search(r'percent|percentage|\brate\b|\bmort\s*%|mortality\s*%', q) else 'mortality_birds'
    elif re.search(r'\bbirds?\s+(?:on hand|remaining|total|numbers?|in shed)\b|\btotal birds\b|\bbird population\b',q):
        metric = 'closing_birds'
    elif re.search(r'\bopening birds\b|\bbirds at start\b',q):
        metric = 'opening_birds'
    if re.search(r'\bcompar(?:e|ison|ing)\b|\bversus\b|\bvs\.?\b', q) and 'flock' in q:
        intent = 'compare_flocks'
    elif re.search(r'\bwhy\b|investigat|what.*(?:wrong|happen)|\bcaus|affected|impact', q):
        intent = 'investigate'
    elif re.search(r'\btop\s+\d+|\bbottom\s+\d+|\brank\b|\bworst\b|\bbest\b', q):
        intent = 'ranking'
    elif re.search(r'\btrend\b|\bgraph\b|\bchart\b|over time', q):
        intent = 'trend'
    elif metric in {'opening_birds','closing_birds'}:
        intent = 'lookup'
    elif metric == 'mortality_birds':
        intent = 'total'
    else:
        intent = 'lookup'
    return {'intent':intent,'metric':metric,'matched_terms':[m[2] for m in matches[:5]]}
