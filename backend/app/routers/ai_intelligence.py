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
    if len(tokens) != 2:
        raise HTTPException(422, "For a custom period, enter both start and end dates, for example 01/07/2026 to 10/07/2026.")
    try:
        start, end = (_parse_date_token(token) for token in tokens)
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


def _card(label, value, unit=""):
    return {"label": label, "value": value, "unit": unit}


@router.post("/ask")
def ask_intelligence(payload: AskRequest, current_user: models.AppUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.module != "layers":
        raise HTTPException(422, "Only Commercial Layers is connected currently.")
    company_id = _permissions(db, current_user, payload.company_id)
    explicit_dates = _question_dates(payload.question)
    plan = _fallback_plan(payload.question)  # No paid AI calls.
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
    items = []
    for data in grouped.values():
        if not data["current"]:
            continue
        flock = data["flock"]
        farm = flock.farm.farm_name if flock.farm else f"Farm {flock.farm_id}"
        shed = flock.shed.shed_name if flock.shed else f"Shed {flock.shed_id}"
        location = plan.get("location")
        if location and location.casefold() not in f"{farm} {shed} {flock.flock_code}".casefold():
            continue
        current, previous = _metrics(data["current"]), _metrics(data["previous"])
        items.append({"farm": farm, "shed": shed, "flock": flock.flock_code, "flock_id": flock.id,
                      "current": current, "previous": previous,
                      "changes": {k: _delta(current[k], previous[k]) for k in ("mortality_pct", "production_pct", "feed_g_bird_day", "water_ml_bird_day", "fcr_kg_dozen")},
                      "daily": sorted(data["current"], key=lambda r: r.entry_date)})
    key_by_intent = {"mortality": "mortality_pct", "feed": "feed_g_bird_day", "water": "water_ml_bird_day", "production": "production_pct", "fcr": "fcr_kg_dozen", "investigate": "production_pct", "overview": "production_pct"}
    key = key_by_intent[intent]
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
    if intent in {"mortality", "investigate", "overview"}:
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
    focus = chosen[0] if chosen else None
    heading = {"mortality": "Mortality ranking", "production": "Hen-day production", "feed": "Feed intake", "water": "Water intake", "fcr": "Feed conversion ratio", "investigate": "Production investigation", "overview": "Commercial Layers overview"}[intent]
    cards = [_card("Reporting flocks", len(items))]
    if intent == "mortality":
        # Total all authorised reporting flocks, NOT just the top-N shown in the table.
        cards.append(_card("Total mortality birds", sum(item["current"]["mortality_birds"] for item in items), " birds"))
    if focus:
        cards.extend([_card({"mortality_pct": "Mortality", "production_pct": "Hen-day production", "feed_g_bird_day": "Feed intake", "water_ml_bird_day": "Water intake", "fcr_kg_dozen": "FCR"}[key], focus["current"][key], {"mortality_pct": "%", "production_pct": "%", "feed_g_bird_day": " g/b/day", "water_ml_bird_day": " mL/b/day", "fcr_kg_dozen": " kg/doz"}[key]), _card("Change vs prior period", focus["changes"][key]), _card("Days recorded", focus["current"]["days_recorded"])])
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
        answer = f"{total:,} mortality birds recorded across {len(items)} authorised reporting flock(s) for {_au(start)} – {_au(end)}." if items else f"No mortality records found for {_au(start)} – {_au(end)} in your authorised Commercial Layers data."
    else:
        answer = f"I found {len(items)} reporting flock(s) in your authorised Commercial Layers data. {heading} results are shown below." if items else f"No matching data was found for {_au(start)} – {_au(end)}."
    return {"title": f"{heading} — {_au(start)} to {_au(end)}", "answer": answer, "scope": scope, "cards": cards, "columns": columns, "rows": rows, "chart": chart, "observations": observations, "capability": intent}
