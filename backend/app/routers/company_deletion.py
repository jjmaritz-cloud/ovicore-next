"""Read-only, Global Admin-only company dependency inventory. No delete endpoint."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import inspect, select, func, text
from sqlalchemy.orm import Session
from app.db import get_db, Base
from app import models
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/admin/company-deletion", tags=["Global Admin Company Deletion"])

@router.get("/preview")
def preview_company(company_id: int, user: models.AppUser = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user.active or not user.is_global_admin:
        raise HTTPException(status_code=403, detail="Global Admin access required")
    if company_id <= 0:
        raise HTTPException(status_code=400, detail="Invalid company")
    company = db.query(models.Company).filter(models.Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    inspector = inspect(db.get_bind())
    table_names = set(inspector.get_table_names())
    dependencies = []
    blockers = ["Permanent company deletion is disabled until the live database schema, foreign keys, backup and non-FK references are verified."]
    counts = {}
    # Metadata is examined without writing. Uses bound params, no user SQL identifiers.
    for table in sorted(Base.metadata.tables.values(), key=lambda t: t.name):
        if table.name not in table_names or "company_id" not in table.c:
            continue
        value = db.execute(select(func.count()).select_from(table).where(table.c.company_id == company_id)).scalar_one()
        counts[table.name] = value
        dependencies.append({"table": table.name, "count": value, "action": "block"})
    unmodelled = sorted(table_names.difference(Base.metadata.tables.keys()))
    if unmodelled:
        blockers.append("Additional live database tables require review: " + ", ".join(unmodelled))
    return {"company_id": company.id, "company_name": company.company_name,
            "counts": counts, "dependencies": dependencies, "blockers": blockers}
