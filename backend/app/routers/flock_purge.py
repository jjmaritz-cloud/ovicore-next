"""Global Admin-only targeted flock purge. Does not change normal flock delete rules."""
import hashlib
import json
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, Integer, String, Text, func
from sqlalchemy.orm import Session

from app.db import Base, get_db
from app import models
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/admin/flock-purge", tags=["Global Admin Flock Purge"])

class FlockPurgeAudit(Base):
    __tablename__ = "flock_purge_audit"
    id = Column(Integer, primary_key=True)
    company_id = Column(Integer, nullable=False, index=True)
    admin_user_id = Column(Integer, nullable=False)
    module = Column(String(20), nullable=False)
    flocks_json = Column(Text, nullable=False)
    daily_rows_deleted = Column(Integer, nullable=False)
    links_detached = Column(Integer, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

class PurgeSelection(BaseModel):
    company_id: int = Field(gt=0)
    module: Literal["rearing", "layers", "broilers", "broiler_plans"]
    flock_ids: list[int] = Field(min_length=1, max_length=1000)

class PurgeExecute(PurgeSelection):
    preview_signature: str
    confirmation: str
    backup_verified: bool = False


def require_global_admin(user):
    if not user.is_global_admin or not user.active:
        raise HTTPException(status_code=403, detail="Global Admin access required")


def selected_models(module):
    if module == "rearing":
        return models.LayerRearingFlock, models.LayerRearingDailyPerformance
    if module == "layers":
        return models.CommercialLayerFlock, models.CommercialLayerDailyPerformance
    if module == "broilers":
        return models.Flock, None
    if module == "broiler_plans":
        return models.BroilerPlacementPlan, models.BroilerDailyPerformance
    raise HTTPException(400, "Unsupported production module")


def inventory(db, payload, lock=False):
    if len(set(payload.flock_ids)) != len(payload.flock_ids) or any(i <= 0 for i in payload.flock_ids):
        raise HTTPException(400, "Flock IDs must be positive and unique")
    if not db.query(models.Company.id).filter(models.Company.id == payload.company_id).first():
        raise HTTPException(404, "Company not found")
    Flock, Daily = selected_models(payload.module)
    q = db.query(Flock).filter(Flock.company_id == payload.company_id, Flock.id.in_(payload.flock_ids))
    if lock:
        q = q.with_for_update()
    found = q.order_by(Flock.id).all()
    if len(found) != len(payload.flock_ids):
        raise HTTPException(409, "Some selected flocks no longer exist in the selected company")
    ids = [f.id for f in found]
    daily_count = 0
    if payload.module == "broiler_plans":
        daily_count = db.query(Daily).filter(Daily.company_id == payload.company_id, Daily.placement_plan_id.in_(ids)).count()
    elif Daily is not None:
        daily_count = db.query(Daily).filter(Daily.company_id == payload.company_id, Daily.flock_id.in_(ids)).count()
    captures_count = 0
    if payload.module == "broiler_plans":
        captures_count = db.query(models.BroilerPaperCapture).filter(
            models.BroilerPaperCapture.company_id == payload.company_id,
            models.BroilerPaperCapture.placement_plan_id.in_(ids)
        ).count()
    # A processing cycle uses a non-FK integer ID. Its ownership is ambiguous:
    # never purge a broiler identifier if any matching processing record exists.
    if payload.module in ("broilers", "broiler_plans"):
        processing = db.query(models.BroilerProcessing.id).filter(
            models.BroilerProcessing.broiler_cycle_id.in_(ids)
        ).first()
        if processing:
            raise HTTPException(409, "Processing references one of these broiler IDs; manual dependency review required")
    # A rearing flock may have produced a laying flock. The laying flock is NOT deleted.
    links = []
    if payload.module == "rearing":
        links = db.query(models.CommercialLayerFlock).filter(
            models.CommercialLayerFlock.source_rearing_flock_id.in_(ids)
        ).all()
        if any(link.company_id != payload.company_id for link in links):
            raise HTTPException(409, "Cross-company transfer linkage detected; purge blocked")
    # Abort if future ORM models introduce other direct FK dependencies.
    # Deleting unexpected dependencies must never happen silently.
    allowed = {Daily.__tablename__} if Daily is not None else set()
    if payload.module == "broiler_plans":
        allowed.add(models.BroilerPaperCapture.__tablename__)
    if payload.module == "rearing":
        allowed.add(models.CommercialLayerFlock.__tablename__)
    for table in Base.metadata.tables.values():
        if table.name in allowed:
            continue
        for fk in table.foreign_keys:
            if fk.column.table.name == Flock.__tablename__:
                # Even an empty dependency deserves explicit code review before purge support.
                raise HTTPException(409, f"Unhandled relation from {table.name}; purge blocked")
    entries = [{"id": f.id, "flock_code": f.cycle_code if payload.module == "broiler_plans" else f.flock_code, "farm_id": f.farm_id,
                "status": f.status, "farm_name": f.farm.farm_name if f.farm else "",
                "shed_name": f.shed.shed_name if f.shed else ""} for f in found]
    canonical = {"company_id": payload.company_id, "module": payload.module, "paper_captures": captures_count,
                 "flocks": entries, "daily_records": daily_count,
                 "linked_layer_ids": sorted(link.id for link in links)}
    signature = hashlib.sha256(json.dumps(canonical, sort_keys=True).encode()).hexdigest()
    return {**canonical, "linked_layers_preserved": len(links), "preview_signature": signature}


@router.get("/flocks")
def list_flocks(company_id: int, module: Literal["rearing", "layers", "broilers", "broiler_plans"],
                user: models.AppUser = Depends(get_current_user), db: Session = Depends(get_db)):
    require_global_admin(user)
    Flock, _ = selected_models(module)
    rows = db.query(Flock).filter(Flock.company_id == company_id).order_by(Flock.id.desc()).all()
    return [{"id": f.id, "flock_code": f.cycle_code if module == "broiler_plans" else f.flock_code, "status": f.status,
             "farm_name": f.farm.farm_name if f.farm else "",
             "shed_name": f.shed.shed_name if f.shed else ""} for f in rows]


@router.post("/preview")
def preview(payload: PurgeSelection, user: models.AppUser = Depends(get_current_user),
            db: Session = Depends(get_db)):
    require_global_admin(user)
    return inventory(db, payload)


@router.post("/execute")
def execute(payload: PurgeExecute, user: models.AppUser = Depends(get_current_user),
            db: Session = Depends(get_db)):
    require_global_admin(user)
    if not payload.backup_verified or payload.confirmation != "PURGE":
        raise HTTPException(400, "Verified backup and exact PURGE confirmation required")
    try:
        summary = inventory(db, payload, lock=True)
        if payload.preview_signature != summary["preview_signature"]:
            raise HTTPException(409, "Selected records changed. Preview again before purging")
        Flock, Daily = selected_models(payload.module)
        ids = [f["id"] for f in summary["flocks"]]
        links_count = 0
        if payload.module == "rearing":
            links_count = db.query(models.CommercialLayerFlock).filter(
                models.CommercialLayerFlock.company_id == payload.company_id,
                models.CommercialLayerFlock.source_rearing_flock_id.in_(ids)
            ).update({models.CommercialLayerFlock.source_rearing_flock_id: None}, synchronize_session=False)
        if payload.module == "broiler_plans":
            # Captures reference daily rows, so remove captures first.
            db.query(models.BroilerPaperCapture).filter(
                models.BroilerPaperCapture.company_id == payload.company_id,
                models.BroilerPaperCapture.placement_plan_id.in_(ids)
            ).delete(synchronize_session=False)
            deleted_daily = db.query(Daily).filter(
                Daily.company_id == payload.company_id,
                Daily.placement_plan_id.in_(ids)
            ).delete(synchronize_session=False)
        elif Daily is not None:
            deleted_daily = db.query(Daily).filter(
                Daily.company_id == payload.company_id,
                Daily.flock_id.in_(ids)
            ).delete(synchronize_session=False)
        else:
            deleted_daily = 0
        deleted_flocks = db.query(Flock).filter(Flock.company_id == payload.company_id,
                                              Flock.id.in_(ids)).delete(synchronize_session=False)
        db.add(FlockPurgeAudit(company_id=payload.company_id, admin_user_id=user.id,
                              module=payload.module, flocks_json=json.dumps(summary["flocks"]),
                              daily_rows_deleted=deleted_daily, links_detached=links_count))
        db.commit()
        return {"deleted_flocks": deleted_flocks, "deleted_daily_records": deleted_daily,
                "linked_layer_flocks_preserved": links_count}
    except Exception:
        db.rollback()
        raise
