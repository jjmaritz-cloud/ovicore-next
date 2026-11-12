from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from app.db import get_db
from app import models
from app.grading_models import EggBatch
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/grading", tags=["Grading - Stage 1"])

class CreateBatch(BaseModel):
    company_id: Optional[int] = None
    flock_id: int = Field(gt=0)
    lay_date: date
    egg_count: int = Field(gt=0)
    batch_code: str = Field(min_length=1, max_length=90)
    storage_location: str = Field(min_length=1, max_length=120)
    notes: Optional[str] = Field(default=None, max_length=500)

class BatchOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    company_id: int
    farm_id: int
    shed_id: int
    flock_id: int
    lay_date: date
    egg_count: int
    batch_code: str
    storage_location: str
    notes: Optional[str]

def company_scope(user: models.AppUser, company_id: Optional[int]) -> int:
    # Administrator-only pilot until a Grading paid-module entitlement is implemented.
    if not (user.is_global_admin or user.is_company_admin):
        raise HTTPException(status_code=403, detail="Grading pilot requires an administrator")
    if user.is_global_admin:
        if company_id is None:
            raise HTTPException(status_code=400, detail="Global admin must select a company_id")
        return company_id
    if user.company_id is None:
        raise HTTPException(status_code=403, detail="No company assigned")
    if company_id is not None and company_id != user.company_id:
        raise HTTPException(status_code=403, detail="Different company not permitted")
    return user.company_id

@router.get("/flocks")
def flocks(company_id: Optional[int] = Query(None), db: Session = Depends(get_db), user: models.AppUser = Depends(get_current_user)):
    cid = company_scope(user, company_id)
    rows = db.query(models.CommercialLayerFlock).filter(models.CommercialLayerFlock.company_id == cid).order_by(models.CommercialLayerFlock.flock_code).all()
    return [{"id": r.id, "flock_code": r.flock_code, "farm_id": r.farm_id, "shed_id": r.shed_id} for r in rows]

@router.get("/batches", response_model=list[BatchOut])
def batches(company_id: Optional[int] = Query(None), db: Session = Depends(get_db), user: models.AppUser = Depends(get_current_user)):
    cid = company_scope(user, company_id)
    return db.query(EggBatch).filter(EggBatch.company_id == cid).order_by(EggBatch.id.desc()).limit(500).all()

@router.post("/batches", response_model=BatchOut, status_code=201)
def create_batch(payload: CreateBatch, db: Session = Depends(get_db), user: models.AppUser = Depends(get_current_user)):
    cid = company_scope(user, payload.company_id)
    flock = db.query(models.CommercialLayerFlock).filter(models.CommercialLayerFlock.id == payload.flock_id, models.CommercialLayerFlock.company_id == cid).first()
    if flock is None:
        raise HTTPException(status_code=404, detail="Flock not found in selected company")
    code = payload.batch_code.strip()
    location = payload.storage_location.strip()
    if not code or not location:
        raise HTTPException(status_code=422, detail="Batch code and storage location are required")
    row = EggBatch(company_id=cid, farm_id=flock.farm_id, shed_id=flock.shed_id, flock_id=flock.id,
                   lay_date=payload.lay_date, egg_count=payload.egg_count, batch_code=code,
                   storage_location=location, notes=payload.notes, created_by_user_id=user.id)
    db.add(row)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Batch code already exists for this company")
    db.refresh(row)
    return row
