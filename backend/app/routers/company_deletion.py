"""Strict Global Admin company deletion, intentionally fail-closed."""
import hashlib
import json
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Column, DateTime, Integer, String, Text, func, inspect, select
from sqlalchemy.orm import Session
from app.db import Base, get_db
from app import models
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/admin/company-deletion", tags=["Global Admin Company Deletion"])

class CompanyDeletionAudit(Base):
    __tablename__ = "company_deletion_audit"
    id = Column(Integer, primary_key=True)
    deleted_company_id = Column(Integer, nullable=False, index=True)
    deleted_company_name = Column(String(255), nullable=False)
    admin_user_id = Column(Integer, nullable=False)
    snapshot_json = Column(Text, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

class DeleteRequest(BaseModel):
    company_id: int = Field(gt=0)
    preview_signature: str
    company_name_confirmation: str
    confirmation: str
    backup_verified: bool = False

ALLOWED_ROWS = {"broiler_farms", "broiler_sheds", "flock_purge_audit"}
SPECIAL_TABLES = {"alembic_version", "company_deletion_audit"}

def require_admin(user):
    if not user.active or not user.is_global_admin:
        raise HTTPException(403, "Global Admin access required")

def inspect_company(db: Session, company_id: int, lock: bool = False):
    q = db.query(models.Company).filter(models.Company.id == company_id)
    if lock: q = q.with_for_update()
    company = q.first()
    if company is None: raise HTTPException(404, "Company not found")
    if company.id == 1 or company.company_name.strip().lower() == "ovicore":
        raise HTTPException(403, "OviCore system company cannot be deleted")

    if company.company_name.strip() != "Surfcoast Eggs - Sandbox":
        raise HTTPException(403, "This controlled deletion route is limited to Surfcoast Eggs - Sandbox")

    inspector = inspect(db.get_bind())
    actual = set(inspector.get_table_names())
    metadata = Base.metadata.tables
    blockers = []
    counts = {}
    dependencies = []
    farm_ids = [r[0] for r in db.query(models.BroilerFarm.id).filter(models.BroilerFarm.company_id == company_id)]
    shed_ids = [r[0] for r in db.query(models.BroilerShed.id).filter(models.BroilerShed.company_id == company_id)]
    for table_name in sorted(actual):
        columns = {c["name"] for c in inspector.get_columns(table_name)}
        if table_name in SPECIAL_TABLES: continue
        if table_name not in metadata and table_name != "broiler_chick_supply":
            blockers.append(f"Unreviewed table {table_name} must be checked")
        # All existing tables, including those not represented in the ORM, are checked.
        if "company_id" in columns:
            from sqlalchemy import MetaData, Table
            from sqlalchemy.sql import func as sqlfunc
            table = metadata.get(table_name)
            if table is None: table = Table(table_name, MetaData(), autoload_with=db.get_bind())
            count = db.execute(select(sqlfunc.count()).select_from(table).where(table.c.company_id == company_id)).scalar_one()
            counts[table_name] = count
            action = "delete" if table_name in ALLOWED_ROWS else "block"
            dependencies.append({"table": table_name, "count": count, "action": action})
            if count and table_name not in ALLOWED_ROWS:
                blockers.append(f"{table_name} contains {count} company records; deletion blocked")
        for col, ids in (("farm_id", farm_ids), ("shed_id", shed_ids)):
            if col in columns and ids and table_name not in ALLOWED_ROWS:
                from sqlalchemy import MetaData, Table
                table = metadata.get(table_name)
                if table is None: table = Table(table_name, MetaData(), autoload_with=db.get_bind())
                n = db.execute(select(func.count()).select_from(table).where(table.c[col].in_(ids))).scalar_one()
                if n: blockers.append(f"{table_name} has {n} records referencing selected {col} values")
        # Explicitly reject unknown foreign-key references to company, farm, and shed.
        for fk in inspector.get_foreign_keys(table_name):
            if fk.get("referred_table") in {"companies", "broiler_farms", "broiler_sheds"} and table_name not in ALLOWED_ROWS and table_name != "company_deletion_audit":
                cols = fk.get("constrained_columns", [])
                if not cols: blockers.append(f"Unhandled FK in {table_name}")
    # broiler_chick_supply is currently outside models.py: never delete if it has rows for the selected company.
    if "broiler_chick_supply" not in actual:
        blockers.append("Expected table broiler_chick_supply missing; check the live schema")
    elif "company_id" not in {c["name"] for c in inspector.get_columns("broiler_chick_supply")}:
        blockers.append("broiler_chick_supply has no company_id; manual ownership review required")
    # Verify the exact simple sandbox footprint; do not assume it remains unchanged.
    for required in ("broiler_farms", "broiler_sheds", "flock_purge_audit"):
        if required not in counts: blockers.append(f"Missing expected table {required}")
    if counts.get("broiler_farms") != 2 or counts.get("broiler_sheds") != 2:
        blockers.append("Farm/shed counts differ from reviewed Surfcoast footprint; inspect again")
    snapshot = {"company_id": company.id, "company_name": company.company_name,
                "counts": counts, "farm_ids": sorted(farm_ids), "shed_ids": sorted(shed_ids)}
    signature = hashlib.sha256(json.dumps(snapshot, sort_keys=True).encode()).hexdigest()
    return company, snapshot, dependencies, sorted(set(blockers)), signature

@router.get("/preview")
def preview(company_id: int, user: models.AppUser = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(user)
    company, snapshot, dependencies, blockers, signature = inspect_company(db, company_id)
    return {"company_id": company.id, "company_name": company.company_name,
            "counts": snapshot["counts"], "dependencies": dependencies, "blockers": blockers,
            "preview_signature": signature}

@router.post("/execute")
def execute(payload: DeleteRequest, user: models.AppUser = Depends(get_current_user), db: Session = Depends(get_db)):
    require_admin(user)
    if not payload.backup_verified or payload.confirmation != "DELETE COMPANY":
        raise HTTPException(400, "Verified backup and DELETE COMPANY confirmation required")
    try:
        company, snapshot, _, blockers, signature = inspect_company(db, payload.company_id, lock=True)
        if payload.company_name_confirmation != company.company_name:
            raise HTTPException(400, "Enter the exact company name to confirm")
        if blockers: raise HTTPException(409, "Deletion blocked: " + "; ".join(blockers))
        if signature != payload.preview_signature: raise HTTPException(409, "Data changed; preview again")
        # Preserve historical purge-audit details in the company deletion audit record.
        from app.routers.flock_purge import FlockPurgeAudit
        old_audits = db.query(FlockPurgeAudit).filter(FlockPurgeAudit.company_id == company.id).all()
        snapshot["prior_purge_audit"] = [dict(id=a.id, module=a.module, flocks_json=a.flocks_json,
            daily_rows_deleted=a.daily_rows_deleted, links_detached=a.links_detached) for a in old_audits]
        db.add(CompanyDeletionAudit(deleted_company_id=company.id, deleted_company_name=company.company_name,
            admin_user_id=user.id, snapshot_json=json.dumps(snapshot)))
        db.query(FlockPurgeAudit).filter(FlockPurgeAudit.company_id == company.id).delete(synchronize_session=False)
        db.query(models.BroilerShed).filter(models.BroilerShed.company_id == company.id).delete(synchronize_session=False)
        db.query(models.BroilerFarm).filter(models.BroilerFarm.company_id == company.id).delete(synchronize_session=False)
        db.delete(company)
        db.commit()
        return {"deleted": True, "company_id": payload.company_id, "company_name": snapshot["company_name"]}
    except Exception:
        db.rollback()
        raise
