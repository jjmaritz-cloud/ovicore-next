"""OviCore Intelligence: verified read-only Commercial Layers analysis.

Phase 1 analytical tool, NOT a general-purpose LLM agent. An LLM planner can
later call this tool with validated structured arguments. No arbitrary SQL.
"""
from collections import defaultdict
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/intelligence", tags=["Intelligence"])


class AskRequest(BaseModel):
    question: str = Field(min_length=5, max_length=2000)
    company_id: int | None = None
    module: str = "layers"


def _period_metrics(rows):
    """Return bird-day-weighted values; missing measurements remain missing."""
    mortality = sum(int(r.mortality_birds or 0) for r in rows)
    culls = sum(int(r.cull_birds or 0) for r in rows)
    bird_days = sum(int(r.opening_birds) for r in rows if r.opening_birds and r.opening_birds > 0)
    paired_feed = [r for r in rows if r.feed_kg is not None and r.opening_birds and r.opening_birds > 0]
    paired_water = [r for r in rows if r.water_litres is not None and r.opening_birds and r.opening_birds > 0]
    feed_bd = sum(int(r.opening_birds) for r in paired_feed)
    water_bd = sum(int(r.opening_birds) for r in paired_water)
    egg_bd = sum(int(r.opening_birds) for r in rows if r.opening_birds and r.opening_birds > 0)
    return {
        "mortality_birds": mortality,
        "culls": culls,
        "mortality_pct": round(100 * mortality / bird_days, 3) if bird_days else None,
        "feed_g_bird_day": round(1000 * sum(float(r.feed_kg) for r in paired_feed) / feed_bd, 1) if feed_bd else None,
        "water_ml_bird_day": round(1000 * sum(float(r.water_litres) for r in paired_water) / water_bd, 0) if water_bd else None,
        "production_pct": round(100 * sum(int(r.total_eggs or 0) for r in rows if r.opening_birds and r.opening_birds > 0) / egg_bd, 2) if egg_bd else None,
        "days_recorded": len({r.entry_date for r in rows}),
        "feed_days": len(paired_feed),
        "water_days": len(paired_water),
    }


def _delta(a, b):
    return round(a - b, 2) if a is not None and b is not None else None


@router.post("/ask")
def ask_intelligence(
    payload: AskRequest,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if payload.module != "layers":
        raise HTTPException(422, "Only Commercial Layers is connected in this first release.")

    # No cross-company lookup except explicit Global Admin working-company selection.
    if current_user.is_global_admin:
        company_id = payload.company_id
        if not company_id:
            raise HTTPException(400, "Select a company before asking a question.")
    else:
        company_id = current_user.company_id
        if not company_id:
            raise HTTPException(403, "User has no company assignment.")

    # Entitlement check is mandatory on the API, not only on the homepage card.
    company = db.query(models.Company).filter(
        models.Company.id == company_id,
        models.Company.active == True,
    ).first()
    if company is None:
        raise HTTPException(404, "Company not found or inactive.")
    if not current_user.is_global_admin:
        if not company.enable_layers:
            raise HTTPException(403, "Commercial Layers is not enabled for your company.")
        if not current_user.is_company_admin:
            assigned = db.query(models.UserModuleAccess.id).filter(
                models.UserModuleAccess.user_id == current_user.id,
                models.UserModuleAccess.module == "layers",
                models.UserModuleAccess.active == True,
            ).first()
            if assigned is None:
                raise HTTPException(403, "You do not have access to Commercial Layers.")

    # Deterministic first query intent; do not claim to answer arbitrary questions.
    q = payload.question.lower()
    if not ("mortal" in q and ("shed" in q or "flock" in q)):
        raise HTTPException(422, "This first version supports ranking sheds/flocks by mortality. Try the suggested question.")
    days_match = re.search(r"(?:last|past|previous)\s+(\d{1,2})\s+days", q)
    top_match = re.search(r"top\s+(\d{1,2})", q)
    days = int(days_match.group(1)) if days_match else 10
    top = int(top_match.group(1)) if top_match else 10
    if not 1 <= days <= 60 or not 1 <= top <= 25:
        raise HTTPException(422, "Use 1–60 days and top 1–25.")

    end = datetime.now(ZoneInfo("Australia/Sydney")).date() - timedelta(days=1)
    start = end - timedelta(days=days - 1)
    baseline_start = start - timedelta(days=days)

    query = (
        db.query(models.CommercialLayerDailyPerformance, models.CommercialLayerFlock)
        .join(models.CommercialLayerFlock, models.CommercialLayerDailyPerformance.flock_id == models.CommercialLayerFlock.id)
        .filter(
            models.CommercialLayerDailyPerformance.company_id == company_id,
            models.CommercialLayerFlock.company_id == company_id,
            models.CommercialLayerDailyPerformance.entry_date >= baseline_start,
            models.CommercialLayerDailyPerformance.entry_date <= end,
        )
    )
    if not (current_user.is_global_admin or current_user.is_company_admin):
        allowed_farms = db.query(models.UserFarmAccess.farm_id).filter(models.UserFarmAccess.user_id == current_user.id)
        query = query.filter(models.CommercialLayerFlock.farm_id.in_(allowed_farms))

    grouped = defaultdict(lambda: {"current": [], "previous": [], "flock": None})
    for record, flock in query.all():
        # Shed + flock allows multiple sequential flock placements in a shed.
        key = (flock.farm_id, flock.shed_id, flock.id)
        period = "current" if record.entry_date >= start else "previous"
        grouped[key][period].append(record)
        grouped[key]["flock"] = flock

    results = []
    for data in grouped.values():
        if not data["current"]:
            continue
        flock = data["flock"]
        now = _period_metrics(data["current"])
        prev = _period_metrics(data["previous"])
        if now["mortality_pct"] is None:
            continue
        results.append({
            "farm": flock.farm.farm_name if flock.farm else f"Farm {flock.farm_id}",
            "shed": flock.shed.shed_name if flock.shed else f"Shed {flock.shed_id}",
            "flock": flock.flock_code,
            "flock_id": flock.id,
            "current": now,
            "previous": prev,
            "changes": {
                "production_pp": _delta(now["production_pct"], prev["production_pct"]),
                "feed_g_bird_day": _delta(now["feed_g_bird_day"], prev["feed_g_bird_day"]),
                "water_ml_bird_day": _delta(now["water_ml_bird_day"], prev["water_ml_bird_day"]),
            },
        })

    results.sort(key=lambda r: (r["current"]["mortality_pct"], r["current"]["mortality_birds"]), reverse=True)
    selected = results[:top]
    cards = [
        {"label": "Sheds / flocks ranked", "value": len(selected)},
        {"label": "Highest mortality", "value": selected[0]["current"]["mortality_pct"] if selected else None, "unit": "%"},
        {"label": "Mortality birds in ranked flocks", "value": sum(r["current"]["mortality_birds"] for r in selected)},
    ]
    if any(r["changes"]["production_pp"] is not None for r in selected):
        cards.append({"label": "Flocks with production decline", "value": sum((r["changes"]["production_pp"] or 0) < 0 for r in selected)})
    return {
        "title": f"Top {top} flocks by mortality — last {days} completed days",
        "scope": {"company_id": company_id, "module": "layers", "start": start.isoformat(), "end": end.isoformat(), "baseline_start": baseline_start.isoformat(), "baseline_end": (start - timedelta(days=1)).isoformat()},
        "method": "Ranked by mortality birds / sum of opening bird-days × 100. Mortality excludes culls. Period comparisons use matched recorded values, not zeros for missing data.",
        "cards": cards,
        "rows": selected,
        "observations": ["Compare changes cautiously: an association in the same period does not establish causation.", "Review recorded-day coverage before acting on feed, water or production changes."],
        "capability": "structured_mortality_analysis_v1",
    }
