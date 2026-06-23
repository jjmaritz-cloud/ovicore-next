from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app import models, schemas

router = APIRouter(
    prefix="/api/broilers/processing",
    tags=["Broiler Processing"],
)


def calculate_processing_fields(record: models.BroilerProcessing):
    actual_birds = record.actual_birds_processed or 0
    planned_birds = record.planned_birds or 0
    live_weight = record.average_live_weight_kg or 0
    dressed_weight = record.average_dressed_weight_kg or 0
    condemned = record.condemned_birds or 0

    if actual_birds > 0 and live_weight > 0:
        record.total_live_weight_kg = round(actual_birds * live_weight, 2)
    else:
        record.total_live_weight_kg = None

    if actual_birds > 0 and dressed_weight > 0:
        record.total_dressed_weight_kg = round(actual_birds * dressed_weight, 2)
    else:
        record.total_dressed_weight_kg = None

    if live_weight > 0 and dressed_weight > 0:
        record.processing_yield_pct = round((dressed_weight / live_weight) * 100, 2)
    else:
        record.processing_yield_pct = None

    if actual_birds > 0:
        record.condemnation_pct = round((condemned / actual_birds) * 100, 2)
    else:
        record.condemnation_pct = None

    if planned_birds > 0 and actual_birds > 0:
        record.mortality_to_processing = planned_birds - actual_birds
    else:
        record.mortality_to_processing = None

    if record.status is None:
        record.status = "Draft"

    return record


@router.get("", response_model=list[schemas.BroilerProcessingOut])
def list_processing_records(db: Session = Depends(get_db)):
    return db.query(models.BroilerProcessing).order_by(models.BroilerProcessing.id.desc()).all()


@router.get("/{record_id}", response_model=schemas.BroilerProcessingOut)
def get_processing_record(record_id: int, db: Session = Depends(get_db)):
    record = (
        db.query(models.BroilerProcessing)
        .filter(models.BroilerProcessing.id == record_id)
        .first()
    )

    if not record:
        raise HTTPException(status_code=404, detail="Processing record not found")

    return record


@router.post("", response_model=schemas.BroilerProcessingOut)
def create_processing_record(
    payload: schemas.BroilerProcessingCreate,
    db: Session = Depends(get_db),
):
    cycle = (
        db.query(models.BroilerDemandPlan)
        .filter(models.BroilerDemandPlan.id == payload.broiler_cycle_id)
        .first()
    )

    if not cycle:
        raise HTTPException(status_code=404, detail="Broiler cycle not found")

    record = models.BroilerProcessing(**payload.model_dump())
    calculate_processing_fields(record)

    db.add(record)
    db.commit()
    db.refresh(record)

    return record


@router.patch("/{record_id}", response_model=schemas.BroilerProcessingOut)
def update_processing_record(
    record_id: int,
    payload: schemas.BroilerProcessingUpdate,
    db: Session = Depends(get_db),
):
    record = (
        db.query(models.BroilerProcessing)
        .filter(models.BroilerProcessing.id == record_id)
        .first()
    )

    if not record:
        raise HTTPException(status_code=404, detail="Processing record not found")

    update_data = payload.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(record, key, value)

    calculate_processing_fields(record)

    db.commit()
    db.refresh(record)

    return record


@router.delete("/{record_id}")
def delete_processing_record(record_id: int, db: Session = Depends(get_db)):
    record = (
        db.query(models.BroilerProcessing)
        .filter(models.BroilerProcessing.id == record_id)
        .first()
    )

    if not record:
        raise HTTPException(status_code=404, detail="Processing record not found")

    db.delete(record)
    db.commit()

    return {"ok": True}