"""Shared OviCore Intelligence API, Commercial Layers connector v2.

Read-only, tenant/farm scoped. Deterministic question parsing only.
No external AI APIs, paid model calls or model-generated SQL.
"""
from collections import defaultdict
from datetime import date, datetime, timedelta
import re
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.routers.auth import get_current_user
from app.routers.intelligence_rules import interpret
from app.routers import intelligence_training
from typing import Any

router = APIRouter(prefix="/api/intelligence", tags=["Intelligence"])
TODAY_TZ = ZoneInfo("Australia/Sydney")
SUPPORTED = ("capabilities", "mortality", "production", "feed", "water", "fcr", "overview", "investigate")


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    company_id: int | None = None
    module: str = "layers"
    start_date: date | None = None
    end_date: date | None = None


def _asfloat(value):
    return float(value) if value is not None else None


def _metrics(rows):
    """Bird-day weighted metrics using only paired available readings.

    Daily mortality excludes culls; FCR is kg feed per dozen TOTAL eggs.
    Don't treat missing feed/water as zero or average daily FCRs.
    """
    birdrows = [r for r in rows if r.opening_birds is not None and r.opening_birds > 0]
    feedrows = [r for r in birdrows if r.feed_kg is not None]
    waterrows = [r for r in birdrows if r.water_litres is not None]
    eggrows = [r for r in birdrows if r.total_eggs is not None]
    fcrrows = [r for r in feedrows if r.total_eggs is not None]
    birddays = sum(r.opening_birds for r in birdrows)
    feedbirddays = sum(r.opening_birds for r in feedrows)
    waterbirddays = sum(r.opening_birds for r in waterrows)
    eggdays = sum(r.opening_birds for r in eggrows)
    eggs = sum(r.total_eggs for r in fcrrows)
    return {
        "mortality_birds": sum(r.mortality_birds or 0 for r in rows),
        "mortality_pct": round(100 * sum(r.mortality_birds or 0 for r in birdrows) / birddays, 3) if birddays else None,
        "feed_g_bird_day": round(1000 * sum(float(r.feed_kg) for r in feedrows) / feedbirddays, 1) if feedbirddays else None,
        "water_ml_bird_day": round(1000 * sum(float(r.water_litres) for r in waterrows) / waterbirddays, 0) if waterbirddays else None,
        "production_pct": round(100 * sum(r.total_eggs for r in eggrows) / eggdays, 2) if eggdays else None,
        "fcr_kg_dozen": round(12 * sum(float(r.feed_kg) for r in fcrrows) / eggs, 3) if eggs > 0 else None,
        "days_recorded": len({r.entry_date for r in rows}),
        "feed_days": len({r.entry_date for r in feedrows}),
        "water_days": len({r.entry_date for r in waterrows}),
        "production_days": len({r.entry_date for r in eggrows}),
        "fcr_days": len({r.entry_date for r in fcrrows}),
    }


def _delta(now, previous):
    return round(now - previous, 2) if now is not None and previous is not None else None


# Explicit dates in the question always outrank UI date presets.
# Both ISO YYYY-MM-DD and Australian DD/MM/YYYY or DD-MM-YYYY are supported.
_DATE_PATTERN = re.compile(r"(?<!\d)(?:\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{4})(?!\d)")


def _parse_date_token(value: str) -> date:
    if re.fullmatch(r"\d{4}-\d{1,2}-\d{1,2}", value):
        parts = [int(n) for n in value.split("-")]
        return date(*parts)
    day, month, year = [int(n) for n in re.split(r"[/-]", value)]
    return date(year, month, day)


def _question_dates(question: str) -> tuple[date, date] | None:
    tokens = _DATE_PATTERN.findall(question)
    if not tokens:
        return None
    if len(tokens) > 2:
        raise HTTPException(422, "Use one date or a start and end date, for example 01/07/2026 to 10/07/2026.")
    try:
        parsed = [_parse_date_token(token) for token in tokens]
        start, end = (parsed[0], parsed[-1])
    except ValueError:
        raise HTTPException(422, "Invalid date. Use DD/MM/YYYY or YYYY-MM-DD and check the day and month.")
    if start > end:
        raise HTTPException(422, "The start date must be on or before the end date.")
    if (end - start).days > 365:
        raise HTTPException(422, "Select a date range of 366 days or fewer.")
    return start, end


def _au(value: date) -> str:
    return value.strftime("%d/%m/%Y")


def _fallback_plan(question):
    q = question.lower()
    match_days = re.search(r"(?:last|past|previous)\s+(\d{1,3})\s+days", q)
    match_top = re.search(r"(?:top|worst|bottom)\s+(\d{1,2})", q)
    days = max(1, min(90, int(match_days.group(1)) if match_days else 10))
    limit = max(1, min(25, int(match_top.group(1)) if match_top else 10))
    if re.search(r"what (?:data|can you|do you)|help|capabilit|available|which metric", q):
        intent = "capabilities"
    elif re.search(r"why|investigat|what.*(wrong|happen)|caus|affected|impact", q):
        intent = "investigate"
    elif "mortal" in q or "morts" in q or "mort " in q or "death" in q or "died" in q:
        intent = "mortality"
    elif "fcr" in q or "conversion" in q:
        intent = "fcr"
    elif "water" in q:
        intent = "water"
    elif "feed" in q:
        intent = "feed"
    elif "production" in q or "hen day" in q or "hd%" in q or "eggs" in q:
        intent = "production"
    else:
        intent = "overview"
    return {"intent": intent, "days": days, "limit": limit, "location": None}


def _permissions(db, current_user, company_id):
    if current_user.is_global_admin:
        if not company_id:
            raise HTTPException(400, "Select a company before asking a question.")
    else:
        company_id = current_user.company_id
        if not company_id:
            raise HTTPException(403, "Your account is not assigned to a company.")
    company = db.query(models.Company).filter(models.Company.id == company_id, models.Company.active == True).first()
    if not company:
        raise HTTPException(404, "Company not found or inactive.")
    if not current_user.is_global_admin:
        if not company.enable_layers:
            raise HTTPException(403, "Commercial Layers is not enabled for this company.")
        if not current_user.is_company_admin:
            assigned = db.query(models.UserModuleAccess.id).filter(
                models.UserModuleAccess.user_id == current_user.id,
                models.UserModuleAccess.module == "layers", models.UserModuleAccess.active == True).first()
            if not assigned:
                raise HTTPException(403, "Commercial Layers access required.")
    return company_id


def _lifecycle_response(db, company_id, user, question, requested_date, metric):
    """Read-only, company-scoped flock/lifecycle lookup. Never guess from trends."""
    q = re.sub(r"[^a-z0-9]+", " ", question.casefold()).strip()
    flocks_q = db.query(models.CommercialLayerFlock).filter(models.CommercialLayerFlock.company_id == company_id)
    if not (user.is_global_admin or user.is_company_admin):
        allowed = db.query(models.UserFarmAccess.farm_id).filter(models.UserFarmAccess.user_id == user.id)
        flocks_q = flocks_q.filter(models.CommercialLayerFlock.farm_id.in_(allowed))
    flocks = flocks_q.all()
    def named(name):
        t = re.sub(r"[^a-z0-9]+", " ", str(name).casefold()).strip()
        return bool(t and re.search(r"(?<!\w)" + re.escape(t) + r"(?!\w)", q))
    def farmname(f): return f.farm.farm_name if f.farm else f"Farm {f.farm_id}"
    def shedname(f): return f.shed.shed_name if f.shed else f"Shed {f.shed_id}"
    farms = {farmname(f) for f in flocks}
    sheds = {shedname(f) for f in flocks}
    codes = {f.flock_code for f in flocks if f.flock_code}
    mf, ms, mc = ({n for n in names if named(n)} for names in (farms, sheds, codes))
    # Detect a named scope even if no authorised record matches it; no broad fallback.
    requested_shed = re.search(r"\bshed\s*#?\s*([a-z0-9-]+)", q)
    if requested_shed and not ms:
        raise HTTPException(404, "The requested shed was not found in your authorised Commercial Layers records.")
    if not (mf or ms or mc):
        raise HTTPException(422, "Name a farm and shed, or a flock, to look up its recorded information.")
    selected = [f for f in flocks if (not mf or farmname(f) in mf) and (not ms or shedname(f) in ms) and (not mc or f.flock_code in mc)]
    if not selected:
        raise HTTPException(404, "No authorised flock matches the farm, shed or flock in your question.")
    today = datetime.now(TODAY_TZ).date()
    if metric == 'placement_date':
        if requested_date is None:
            active = [f for f in selected if str(f.status or '').casefold() == 'active']
            selected = active if active else selected
        else:
            selected = [f for f in selected if f.housed_date and f.housed_date <= requested_date]
        if len(selected) != 1:
            raise HTTPException(422, "More than one flock matches this shed. Include the farm and flock code to identify the placement date.")
        f = selected[0]
        if not f.housed_date:
            raise HTTPException(404, "No placement/housing date has been recorded for this flock.")
        return {'title':f'Flock placement — {shedname(f)}', 'answer':f'{f.flock_code} was placed in {farmname(f)} / {shedname(f)} on {_au(f.housed_date)}.',
                'scope':{'company_id':company_id,'module':'layers'}, 'cards':[_card('Placement date',_au(f.housed_date)),_card('Flock',f.flock_code)],
                'columns':[], 'rows':[], 'chart':None,'observations':['Date is taken from the flock housing record.'],'capability':'placement'}
    # Bird count: exact date when supplied; otherwise most recent recorded reading in active flock.
    if requested_date is None:
        selected = [f for f in selected if str(f.status or '').casefold() == 'active']
        if not selected:
            raise HTTPException(404, "No active flock was found for that shed. Specify a historical flock code or date.")
    if requested_date is not None:
        selected = [f for f in selected if (f.housed_date is None or f.housed_date <= requested_date)]
    if len(selected) != 1:
        raise HTTPException(422, "More than one flock matches. Include the farm and flock code for an unambiguous bird count.")
    f = selected[0]
    records = db.query(models.CommercialLayerDailyPerformance).filter(
        models.CommercialLayerDailyPerformance.company_id == company_id,
        models.CommercialLayerDailyPerformance.flock_id == f.id,
        getattr(models.CommercialLayerDailyPerformance,metric).isnot(None))
    if requested_date is not None:
        records = records.filter(models.CommercialLayerDailyPerformance.entry_date == requested_date)
    else:
        records = records.filter(models.CommercialLayerDailyPerformance.entry_date <= today)
    record = records.order_by(models.CommercialLayerDailyPerformance.entry_date.desc()).first()
    if record is None:
        detail = f'on {_au(requested_date)}' if requested_date else 'for the active flock'
        raise HTTPException(404, f'No recorded bird population is available {detail}.')
    count = int(getattr(record,metric))
    label = 'Opening birds' if metric == 'opening_birds' else 'Closing birds'
    age = (today - record.entry_date).days
    note = f'Latest recorded daily entry: {_au(record.entry_date)}.' if requested_date is None else f'Exact recorded entry: {_au(record.entry_date)}.'
    if requested_date is None and age > 2:
        note += f' Warning: this record is {age} days old; the displayed stock may not be current.'
    return {'title':f'{label} — {shedname(f)}', 'answer':f'{count:,} birds ({label.lower()}) in {farmname(f)} / {shedname(f)} / {f.flock_code} as recorded on {_au(record.entry_date)}.',
            'scope':{'company_id':company_id,'module':'layers'},'cards':[_card(label,count,' birds'),_card('Recorded on',_au(record.entry_date)),_card('Flock',f.flock_code)],
            'columns':[{'key':'farm','label':'Farm'},{'key':'shed','label':'Shed'},{'key':'flock','label':'Flock'},{'key':'date','label':'Date'}, {'key':'opening_birds','label':'Opening birds'},{'key':'closing_birds','label':'Closing birds'}],
            'rows':[{'id':f.id,'farm':farmname(f),'shed':shedname(f),'flock':f.flock_code,'date':_au(record.entry_date),'opening_birds':record.opening_birds,'closing_birds':record.closing_birds}],
            'chart':None,'observations':[note,'Bird count comes from the recorded daily data, not a sum of daily populations.'],'capability':'population'}


def _card(label, value, unit=""):
    return {"label": label, "value": value, "unit": unit}


@router.post("/ask")
def ask_intelligence(payload: AskRequest, current_user: models.AppUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.module != "layers":
        raise HTTPException(422, "Only Commercial Layers is connected currently.")
    company_id = _permissions(db, current_user, payload.company_id)
    explicit_dates = _question_dates(payload.question)
    plan = _fallback_plan(payload.question)  # Preserve original fallback and response contract.
    # Depop dates are not yet connected: never substitute production KPIs.
    if re.search(r"\b(?:depopulat(?:e|ed|ion|ing)?|depop|destock|empty\s+(?:the\s+)?shed)\b",payload.question,re.I):
        raise HTTPException(422, "I understand this is a depopulation question, but planned and actual depopulation dates are not connected to Intelligence yet. No date has been assumed.")
    # Placement/housing date is a flock lifecycle lookup, not a performance metric.
    if re.search(r"\b(?:when|what\s+date|placement\s+date|housing\s+date)\b",payload.question,re.I) and re.search(r"\b(?:plac(?:e|ed|ement)|hous(?:e|ed|ing))\b",payload.question,re.I):
        dates = _question_dates(payload.question)
        return _lifecycle_response(db, company_id, current_user, payload.question, dates[1] if dates else None, 'placement_date')
    learned = interpret(payload.question, intelligence_training.active_rules(db))  # Reviewed local rules only.
    metric = learned['metric']
    # Unsupported advanced questions must not silently return unrelated statistics.
    if learned['intent'] == 'compare_flocks':
        raise HTTPException(422, "Same-age flock comparison is not connected yet. Ask about one flock or metric while comparison support is developed.")
    if metric in ('closing_birds','opening_birds'):
        dates = _question_dates(payload.question)
        if dates and dates[0] != dates[1]:
            raise HTTPException(422, "Bird population is a point-in-time value. Specify one date or ask for the latest recorded stock.")
        return _lifecycle_response(db, company_id, current_user, payload.question, dates[0] if dates else None, metric)
    if metric is None and plan['intent'] == 'overview' and not re.search(r"\b(?:overview|summary|performance|how\s+(?:are|is)\s+(?:my|the)\s+(?:flock|farm|shed))\b",payload.question,re.I):
        raise HTTPException(422, "I haven't connected that type of question yet. Try asking about mortality, feed, water, production, bird numbers or flock placement.")
    if metric == 'closing_birds' or metric == 'opening_birds':
        plan['intent'] = 'population'
    elif metric in ('mortality_birds', 'mortality_pct'):
        plan['intent'] = 'mortality'
    elif metric == 'production_pct':
        plan['intent'] = 'production'
    elif metric == 'feed_g_bird_day':
        plan['intent'] = 'feed'
    elif metric == 'water_ml_bird_day':
        plan['intent'] = 'water'
    elif metric == 'fcr_kg_dozen':
        plan['intent'] = 'fcr'

    # Detect ALL requested production metrics, independently of the first dictionary match.
    # Strict word boundaries avoid detecting HD inside other words, or feed in "feed cost".
    q = payload.question.casefold()
    patterns = (
        ('production_pct', r'(?:\b(?:hen[ -]?day|henday|production|lay\s*rate|laying\s*percentage)\b|\bhd\s*%)'),
        ('feed_g_bird_day', r'\b(?:feed(?:ing)?|feed\s+intake|gbd|grams\s+per\s+bird|ration\s+intake)\b'),
        ('water_ml_bird_day', r'\b(?:water|drinking|ml\s*/\s*bird)\b'),
        ('mortality_pct', r'\b(?:mortality|morts?|deaths?|died|mort\s*%)\b'),
        ('fcr_kg_dozen', r'\b(?:fcr|feed\s+conversion|kg\s*/\s*dozen)\b'),
    )
    requested_metrics = [key for key, pattern in patterns if re.search(pattern, q)]
    # Rules loaded from Teach OviCore remain a source of additional phrases.
    if metric in dict(patterns) and metric not in requested_metrics:
        requested_metrics.append(metric)
    # A plain comparison of one metric with a prior period is NOT a multi-metric query.
    multi_metrics = requested_metrics if len(requested_metrics) >= 2 and plan['intent'] != 'investigate' else []
    if multi_metrics:
        # Keep the existing selection/sorting pipeline; later override the visible
        # columns, cards and chart with every metric explicitly requested.
        primary = multi_metrics[0]
        plan['intent'] = {'production_pct':'production','feed_g_bird_day':'feed',
                          'water_ml_bird_day':'water','mortality_pct':'mortality',
                          'fcr_kg_dozen':'fcr'}[primary]

    # Dates, including those typed in natural language, are parsed deterministically.
    intent, days, limit = plan["intent"], plan["days"], plan["limit"]
    scope = {"company_id": company_id, "module": "layers"}
    if intent == "capabilities":
        return {"title": "What OviCore Intelligence can analyse", "answer": "Commercial Layers is connected. I can examine mortality, feed per bird, water per bird, hen-day production, FCR and recent trends, rank sheds or flocks, and highlight changes for on-farm investigation. Rearing, Feed Mill and People Tracker analysis will be added later.", "scope": scope, "cards": [], "columns": [], "rows": [], "chart": None, "observations": ["Try: Which sheds have the highest mortality over the last 10 days?", "Try: Show the production trend for the last 30 days.", "Try: Why has production dropped in Shed 1?"], "capability": "capabilities"}
    if explicit_dates:
        start, end = explicit_dates
    elif payload.start_date is not None or payload.end_date is not None:
        if payload.start_date is None or payload.end_date is None:
            raise HTTPException(422, "Both custom start and end dates are required.")
        start, end = payload.start_date, payload.end_date
        if start > end:
            raise HTTPException(422, "The start date must be on or before the end date.")
        if (end - start).days > 365:
            raise HTTPException(422, "Select a date range of 366 days or fewer.")
    else:
        end = datetime.now(TODAY_TZ).date() - timedelta(days=1)
        start = end - timedelta(days=days - 1)
    days = (end - start).days + 1
    baseline = start - timedelta(days=days)
    scope.update({"start": start.isoformat(), "end": end.isoformat(), "previous_start": baseline.isoformat(), "previous_end": (start - timedelta(days=1)).isoformat()})
    query = (db.query(models.CommercialLayerDailyPerformance, models.CommercialLayerFlock)
             .join(models.CommercialLayerFlock, models.CommercialLayerDailyPerformance.flock_id == models.CommercialLayerFlock.id)
             .filter(models.CommercialLayerDailyPerformance.company_id == company_id,
                     models.CommercialLayerFlock.company_id == company_id,
                     models.CommercialLayerDailyPerformance.entry_date >= baseline,
                     models.CommercialLayerDailyPerformance.entry_date <= end))
    if not (current_user.is_global_admin or current_user.is_company_admin):
        allowed = db.query(models.UserFarmAccess.farm_id).filter(models.UserFarmAccess.user_id == current_user.id)
        query = query.filter(models.CommercialLayerFlock.farm_id.in_(allowed))
    grouped = defaultdict(lambda: {"current": [], "previous": [], "flock": None})
    for record, flock in query.all():
        slot = grouped[flock.id]
        slot["flock"] = flock
        slot["current" if record.entry_date >= start else "previous"].append(record)
    # Resolve farm, shed and flock names only against the already authorised records.
    # Prefer longest recognised entity name, then require shed+farm qualification if ambiguous.
    authorised = [d['flock'] for d in grouped.values()]
    qnorm = re.sub(r'[^a-z0-9]+', ' ', payload.question.casefold()).strip()
    def present(name):
        val = re.sub(r'[^a-z0-9]+', ' ', str(name).casefold()).strip()
        return bool(val and re.search(r'(?<!\w)' + re.escape(val) + r'(?!\w)', qnorm))
    farm_names = {f.farm.farm_name for f in authorised if f.farm and f.farm.farm_name}
    shed_names = {f.shed.shed_name for f in authorised if f.shed and f.shed.shed_name}
    flock_names = {f.flock_code for f in authorised if f.flock_code}
    matched_farms = {n for n in farm_names if present(n)}
    matched_sheds = {n for n in shed_names if present(n)}
    matched_flocks = {n for n in flock_names if present(n)}
    # Short references such as 'Shed 1' match the known shed name; avoid matching 'Shed 10'.
    items = []
    for data in grouped.values():
        if not data["current"]:
            continue
        flock = data["flock"]
        farm = flock.farm.farm_name if flock.farm else f"Farm {flock.farm_id}"
        shed = flock.shed.shed_name if flock.shed else f"Shed {flock.shed_id}"
        if matched_farms and farm not in matched_farms:
            continue
        if matched_sheds and shed not in matched_sheds:
            continue
        if matched_flocks and flock.flock_code not in matched_flocks:
            continue
        location = plan.get("location")
        if location and location.casefold() not in f"{farm} {shed} {flock.flock_code}".casefold():
            continue
        current, previous = _metrics(data["current"]), _metrics(data["previous"])
        items.append({"farm": farm, "shed": shed, "flock": flock.flock_code, "flock_id": flock.id,
                      "current": current, "previous": previous,
                      "changes": {k: _delta(current[k], previous[k]) for k in ("mortality_pct", "production_pct", "feed_g_bird_day", "water_ml_bird_day", "fcr_kg_dozen")},
                      "daily": sorted(data["current"], key=lambda r: r.entry_date)})
    key_by_intent = {"population": "production_pct", "mortality": "mortality_pct", "feed": "feed_g_bird_day", "water": "water_ml_bird_day", "production": "production_pct", "fcr": "fcr_kg_dozen", "investigate": "production_pct", "overview": "production_pct"}
    key = key_by_intent[intent]
    if intent == 'population':
        # End-of-day population is a point-in-time reading, not a summable daily metric.
        target = metric or 'closing_birds'
        unique_dates = sorted({r.entry_date for i in items for r in i['daily']})
        if len(unique_dates) != 1:
            raise HTTPException(422, "For bird population, specify one date (DD/MM/YYYY) and a farm/shed or flock.")
        if len(items) != 1:
            raise HTTPException(422, "For bird population, specify one flock or a farm and shed. Multiple flocks cannot be silently combined.")
        selected = items[0]
        readings = [r for r in selected['daily'] if getattr(r, target) is not None]
        if len(readings) != 1:
            raise HTTPException(422, "There is no unambiguous recorded bird population for this flock and date.")
        record = readings[0]
        value = int(getattr(record, target))
        unit = ' birds'
        label = 'Closing birds' if target == 'closing_birds' else 'Opening birds'
        info = f"{label}: {value:,} birds at {selected['farm']} / {selected['shed']} / {selected['flock']} on {_au(record.entry_date)}."
        cols = [{'key':'farm','label':'Farm'}, {'key':'shed','label':'Shed'}, {'key':'flock','label':'Flock'},
                {'key':'date','label':'Date'}, {'key':'opening_birds','label':'Opening birds'},
                {'key':'mortality_birds','label':'Morts'}, {'key':'cull_birds','label':'Culls'},
                {'key':'closing_birds','label':'Closing birds'}]
        rr = {'id':selected['flock_id'],'farm':selected['farm'],'shed':selected['shed'], 'flock':selected['flock'],
              'date':_au(record.entry_date),'opening_birds':record.opening_birds,
              'mortality_birds':record.mortality_birds,'cull_birds':record.cull_birds,'closing_birds':record.closing_birds}
        return {'title':f"{label} — {_au(record.entry_date)}", 'answer':info, 'scope':scope,
                'cards':[_card(label,value,unit)],'columns':cols,'rows':[rr], 'chart':None,
                'observations':['Population is read directly from the recorded daily entry, not estimated or summed over time.'],
                'capability':'population'}
    descending = intent in {"mortality", "fcr"} or "highest" in payload.question.lower() or "top" in payload.question.lower()
    if intent in {"production", "feed", "water", "investigate", "overview"} and ("worst" in payload.question.lower() or "drop" in payload.question.lower() or "lowest" in payload.question.lower()):
        descending = False
    items.sort(key=lambda item: (item["current"][key] is None, -(item["current"][key] or 0) if descending else (item["current"][key] or 0)))
    chosen = items[:limit]
    columns = [
        {"key": "farm", "label": "Farm"}, {"key": "shed", "label": "Shed"}, {"key": "flock", "label": "Flock"},
        {"key": key, "label": {"mortality_pct": "Mort %", "production_pct": "HD %", "feed_g_bird_day": "Feed g/b/day", "water_ml_bird_day": "Water mL/b/day", "fcr_kg_dozen": "FCR kg/doz"}[key]},
        {"key": "delta", "label": "Change vs prior period"},
        {"key": "days_recorded", "label": "Days recorded"},
    ]
    if intent in {"mortality", "investigate", "overview"} or bool(multi_metrics):
        if intent == "mortality":
            columns += [{"key": "mortality_birds", "label": "Mortality birds"}]
        columns += [{"key": "feed_g_bird_day", "label": "Feed g/b/day"}, {"key": "water_ml_bird_day", "label": "Water mL/b/day"}, {"key": "production_pct", "label": "HD %"}]
    rows = []
    for item in chosen:
        row = {"id": item["flock_id"], "farm": item["farm"], "shed": item["shed"], "flock": item["flock"],
               "delta": item["changes"][key], "days_recorded": item["current"]["days_recorded"]}
        row.update(item["current"])
        rows.append(row)
    # Time-series graph contains measured values aggregated across selected visible flocks.
    chart = None
    if intent in {"production", "feed", "water", "fcr", "investigate", "overview"} and chosen:
        by_day = defaultdict(list)
        for item in chosen:
            for record in item["daily"]:
                by_day[record.entry_date].append(record)
        points = [{"date": d.isoformat(), "value": _metrics(day)[key]} for d, day in sorted(by_day.items())]
        chart = {"title": "Daily trend — selected flocks", "metric": key, "points": points}
    if multi_metrics and chosen:
        by_day = defaultdict(list)
        for item in chosen:
            for record in item['daily']:
                by_day[record.entry_date].append(record)
        labels = {
            'production_pct': ('Hen-day production','%'),
            'feed_g_bird_day': ('Feed intake','g/bird/day'),
            'water_ml_bird_day': ('Water intake','mL/bird/day'),
            'mortality_pct': ('Daily mortality rate','% per bird-day'),
            'fcr_kg_dozen': ('FCR','kg/dozen'),
        }
        # At most two independent axes in one chart. For 3+ metrics, emit a
        # chart group, each with at most two series and clearly labelled units.
        all_daily = [{'date': d.isoformat(), **{m: _metrics(day)[m] for m in multi_metrics}}
                     for d, day in sorted(by_day.items())]
        def make_chart(keys):
            return {
                'title': 'Daily trends — ' + ' & '.join(labels[k][0] for k in keys),
                'metric': 'multi',
                'series': [{'key':m,'label':labels[m][0],'unit':labels[m][1]} for m in keys],
                'points': [{'date':point['date'],**{m:point[m] for m in keys}} for point in all_daily],
            }
        chart = make_chart(multi_metrics[:2])
        if len(multi_metrics)>2:
            chart['additional_charts'] = [make_chart(multi_metrics[i:i+2])
                                          for i in range(2,len(multi_metrics),2)]
        columns = [{'key':k,'label':label} for k,label in
                   [('farm','Farm'),('shed','Shed'),('flock','Flock')]] + [
                       {'key':m,'label':f'{labels[m][0]} ({labels[m][1]})'}
                       for m in multi_metrics] + [{'key':'days_recorded','label':'Days recorded'}]
    focus = chosen[0] if chosen else None
    heading = {"mortality": "Mortality ranking", "production": "Hen-day production", "feed": "Feed intake", "water": "Water intake", "fcr": "Feed conversion ratio", "investigate": "Production investigation", "overview": "Commercial Layers overview"}[intent]
    cards = [_card("Reporting flocks", len(items))]
    if intent == "mortality":
        # Total all authorised reporting flocks, NOT just the top-N shown in the table.
        cards.append(_card("Total mortality birds", sum(item["current"]["mortality_birds"] for item in items), " birds"))
    if focus:
        cards.extend([_card({"mortality_pct": "Mortality", "production_pct": "Hen-day production", "feed_g_bird_day": "Feed intake", "water_ml_bird_day": "Water intake", "fcr_kg_dozen": "FCR"}[key], focus["current"][key], {"mortality_pct": "%", "production_pct": "%", "feed_g_bird_day": " g/b/day", "water_ml_bird_day": " mL/b/day", "fcr_kg_dozen": " kg/doz"}[key]), _card("Change vs prior period", focus["changes"][key]), _card("Days recorded", focus["current"]["days_recorded"])])
    if multi_metrics:
        headings = {'production_pct':'HD%', 'feed_g_bird_day':'Feed',
                    'water_ml_bird_day':'Water','mortality_pct':'Mortality',
                    'fcr_kg_dozen':'FCR'}
        heading = ' and '.join(headings[m] for m in multi_metrics)
        if focus:
            units = {'production_pct':'%', 'feed_g_bird_day':' g/b/day',
                     'water_ml_bird_day':' mL/b/day','mortality_pct':'% per bird-day',
                     'fcr_kg_dozen':' kg/doz'}
            cards = [_card('Reporting flocks',len(items))] + [
                _card(headings[m],focus['current'][m],units[m]) for m in multi_metrics]
    observations = ["Comparisons use the preceding equal-length calendar period; missing values are excluded rather than counted as zero."]
    if focus:
        changes = focus["changes"]
        for metric, name, unit in (("water_ml_bird_day", "Water", " mL/bird/day"), ("feed_g_bird_day", "Feed", " g/bird/day"), ("production_pct", "Production", " percentage points")):
            value = changes[metric]
            if value is not None:
                observations.append(f"{focus['farm']} / {focus['shed']}: {name} {'fell' if value < 0 else 'rose' if value > 0 else 'was unchanged'} by {abs(value):g}{unit} compared with the prior period.")
    if intent == "investigate":
        observations.append("Check water systems, feeder access, ration/delivery changes, environmental conditions and daily entry accuracy. These are investigation prompts, not a diagnosis or proof of causation.")
    else:
        observations.append("Changes occurring together are associations, not proof of causation. Confirm daily coverage and flock age before decisions.")
    if not chosen:
        observations = ["No matching, authorised Commercial Layers records were found for the selected period or named location. Try a broader question or another date range."]
    if intent == "mortality":
        total = sum(item["current"]["mortality_birds"] for item in items)
        if metric == 'mortality_pct':
            # Existing metric is deaths / opening bird-DAYS (daily exposure rate).
            # Recompute across all matched rows rather than use the first/ranked flock.
            allrows = [r for item in items for r in item['daily']]
            measured = _metrics(allrows)
            rate = measured['mortality_pct']
            answer = (f"Mortality was {rate:.3f}% per bird-day across {len(items)} authorised flock(s) "
                      f"for {_au(start)} – {_au(end)} ({total:,} birds died). This is a bird-day based daily "
                      f"mortality rate, not total period mortality as a percentage of opening flock size.") if rate is not None else "No valid opening-bird denominator was recorded for mortality percentage."
            cards = [_card('Daily mortality rate',rate,'%'),_card('Mortality birds',total,' birds'),_card('Reporting flocks',len(items))]
        else:
            answer = f"{total:,} mortality birds recorded across {len(items)} authorised reporting flock(s) for {_au(start)} – {_au(end)}." if items else f"No mortality records found for {_au(start)} – {_au(end)} in your authorised Commercial Layers data."
    else:
        answer = f"I found {len(items)} reporting flock(s) in your authorised Commercial Layers data. {heading} results are shown below." if items else f"No matching data was found for {_au(start)} – {_au(end)}."
    if multi_metrics and focus:
        parts = []
        for m in multi_metrics:
            val = focus['current'][m]
            unit = {'production_pct':'%','feed_g_bird_day':'g/bird/day',
                    'water_ml_bird_day':'mL/bird/day','mortality_pct':'% per bird-day',
                    'fcr_kg_dozen':'kg/dozen'}[m]
            label = {'production_pct':'HD production','feed_g_bird_day':'feed intake',
                     'water_ml_bird_day':'water intake','mortality_pct':'daily mortality rate',
                     'fcr_kg_dozen':'FCR'}[m]
            parts.append(f'{label}: {val:g} {unit}' if val is not None else f'{label}: no valid readings')
        answer = f"For {_au(start)} – {_au(end)} at {focus['farm']} / {focus['shed']}: " + '; '.join(parts) + '.'
        observations.append('Each series uses its own valid daily denominator. Separate axes apply when units differ. Missing readings are not zeros.')
    return {"title": f"{heading} — {_au(start)} to {_au(end)}", "answer": answer, "scope": scope, "cards": cards, "columns": columns, "rows": rows, "chart": chart, "observations": observations, "capability": intent}


class TrainingPackRequest(BaseModel):
    package: dict[str, Any]

class TrainingToggleRequest(BaseModel):
    enabled: bool

def _require_training_admin(current_user):
    if not current_user.is_global_admin:
        raise HTTPException(403, "Only OviCore Global Administrators can manage shared training rules.")

@router.get("/training/packs")
def list_training_packs(current_user: models.AppUser = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_training_admin(current_user)
    return {"packs": intelligence_training.packs(db),"allowed_metrics":sorted(intelligence_training.SUPPORTED_METRICS)}

@router.post("/training/validate")
def validate_training_pack(payload: TrainingPackRequest, current_user: models.AppUser = Depends(get_current_user)):
    _require_training_admin(current_user)
    package=intelligence_training.validate_pack(payload.package)
    return {"valid":True,"name":package['name'],"rules":package['rules'],"note":"Rules only map phrases to existing metrics. No code or calculation changes."}

@router.post("/training/import")
def import_training_pack(payload: TrainingPackRequest, current_user: models.AppUser = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_training_admin(current_user)
    pack_id=intelligence_training.add_pack(db,payload.package,current_user.id)
    return {"id":pack_id,"message":"Training rules activated. New questions use them immediately."}

@router.patch("/training/packs/{pack_id}")
def toggle_training_pack(pack_id:int, payload: TrainingToggleRequest, current_user: models.AppUser = Depends(get_current_user), db: Session = Depends(get_db)):
    _require_training_admin(current_user)
    intelligence_training.set_pack_enabled(db,pack_id,payload.enabled)
    return {"id":pack_id,"enabled":payload.enabled}
