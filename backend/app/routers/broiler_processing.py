from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.db import get_db
from app.routers.auth import get_current_user


router = APIRouter(
    prefix="/api/broilers/processing",
    tags=["Broiler Processing"],
)

def calculate_processing_fields(
    record: models.BroilerProcessing,
):
    actual_birds = record.actual_birds_processed or 0
    planned_birds = record.planned_birds or 0
    live_weight = record.average_live_weight_kg or 0
    dressed_weight = (
        record.average_dressed_weight_kg or 0
    )
    condemned = record.condemned_birds or 0

    if actual_birds > 0 and live_weight > 0:
        record.total_live_weight_kg = round(
            actual_birds * live_weight,
            2,
        )
    else:
        record.total_live_weight_kg = None

    if actual_birds > 0 and dressed_weight > 0:
        record.total_dressed_weight_kg = round(
            actual_birds * dressed_weight,
            2,
        )
    else:
        record.total_dressed_weight_kg = None

    if live_weight > 0 and dressed_weight > 0:
        record.processing_yield_pct = round(
            (dressed_weight / live_weight) * 100,
            2,
        )
    else:
        record.processing_yield_pct = None

    if actual_birds > 0:
        record.condemnation_pct = round(
            (condemned / actual_birds) * 100,
            2,
        )
    else:
        record.condemnation_pct = None

    if planned_birds > 0 and actual_birds > 0:
        record.mortality_to_processing = (
            planned_birds - actual_birds
        )
    else:
        record.mortality_to_processing = None

    if record.status is None:
        record.status = "Draft"

    return record


def require_cycle_access(
    db: Session,
    current_user: models.AppUser,
    cycle_id: int,
) -> models.BroilerPlacementPlan:
    cycle = (
        db.query(models.BroilerPlacementPlan)
        .filter(
            models.BroilerPlacementPlan.id == cycle_id
        )
        .first()
    )

    if not cycle:
        raise HTTPException(
            status_code=404,
            detail="Broiler cycle not found",
        )

    if (
        not current_user.is_global_admin
        and cycle.company_id != current_user.company_id
    ):
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this company",
        )

    if not (
        current_user.is_global_admin
        or current_user.is_company_admin
    ):
        has_farm_access = (
            db.query(models.UserFarmAccess)
            .filter(
                models.UserFarmAccess.user_id
                == current_user.id,
                models.UserFarmAccess.farm_id
                == cycle.farm_id,
            )
            .first()
        )

        if not has_farm_access:
            raise HTTPException(
                status_code=403,
                detail="You do not have access to this farm",
            )

    return cycle


def accessible_processing_query(
    db: Session,
    current_user: models.AppUser,
):
    query = (
        db.query(models.BroilerProcessing)
        .join(
            models.BroilerPlacementPlan,
            models.BroilerPlacementPlan.id
            == models.BroilerProcessing.broiler_cycle_id,
        )
        .filter(
            models.BroilerProcessing.company_id
            == models.BroilerPlacementPlan.company_id
        )
    )

    if not current_user.is_global_admin:
        query = query.filter(
            models.BroilerProcessing.company_id
            == current_user.company_id,
            models.BroilerPlacementPlan.company_id
            == current_user.company_id,
        )

    if not (
        current_user.is_global_admin
        or current_user.is_company_admin
    ):
        permitted_farm_ids = (
            db.query(models.UserFarmAccess.farm_id)
            .filter(
                models.UserFarmAccess.user_id
                == current_user.id
            )
        )

        query = query.filter(
            models.BroilerPlacementPlan.farm_id.in_(
                permitted_farm_ids
            )
        )

    return query


@router.get(
    "",
    response_model=list[schemas.BroilerProcessingOut],
)
def list_processing_records(
    current_user: models.AppUser = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    return (
        accessible_processing_query(
            db,
            current_user,
        )
        .order_by(
            models.BroilerProcessing.id.desc()
        )
        .all()
    )


@router.get(
    "/{record_id}",
    response_model=schemas.BroilerProcessingOut,
)
def get_processing_record(
    record_id: int,
    current_user: models.AppUser = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    record = (
        accessible_processing_query(
            db,
            current_user,
        )
        .filter(
            models.BroilerProcessing.id == record_id
        )
        .first()
    )

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Processing record not found",
        )

    return record


@router.post(
    "",
    response_model=schemas.BroilerProcessingOut,
)
def create_processing_record(
    payload: schemas.BroilerProcessingCreate,
    current_user: models.AppUser = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    cycle = require_cycle_access(
        db,
        current_user,
        payload.broiler_cycle_id,
    )

    existing = (
        db.query(models.BroilerProcessing)
        .filter(
            models.BroilerProcessing.company_id
            == cycle.company_id,
            models.BroilerProcessing.broiler_cycle_id
            == cycle.id,
        )
        .first()
    )

    payload_data = payload.model_dump(
        exclude_unset=True
    )

    payload_data.pop("company_id", None)
    payload_data.pop("broiler_cycle_id", None)

    if existing:
        for key, value in payload_data.items():
            setattr(existing, key, value)

        calculate_processing_fields(existing)

        db.commit()
        db.refresh(existing)

        return existing

    record = models.BroilerProcessing(
        company_id=cycle.company_id,
        broiler_cycle_id=cycle.id,
        **payload_data,
    )

    calculate_processing_fields(record)

    db.add(record)
    db.commit()
    db.refresh(record)

    return record


@router.patch(
    "/{record_id}",
    response_model=schemas.BroilerProcessingOut,
)
def update_processing_record(
    record_id: int,
    payload: schemas.BroilerProcessingUpdate,
    current_user: models.AppUser = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    record = (
        accessible_processing_query(
            db,
            current_user,
        )
        .filter(
            models.BroilerProcessing.id == record_id
        )
        .first()
    )

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Processing record not found",
        )

    require_cycle_access(
        db,
        current_user,
        record.broiler_cycle_id,
    )

    update_data = payload.model_dump(
        exclude_unset=True
    )

    update_data.pop("company_id", None)
    update_data.pop("broiler_cycle_id", None)

    for key, value in update_data.items():
        setattr(record, key, value)

    calculate_processing_fields(record)

    db.commit()
    db.refresh(record)

    return record


@router.delete("/{record_id}")
def delete_processing_record(
    record_id: int,
    current_user: models.AppUser = Depends(
        get_current_user
    ),
    db: Session = Depends(get_db),
):
    record = (
        accessible_processing_query(
            db,
            current_user,
        )
        .filter(
            models.BroilerProcessing.id == record_id
        )
        .first()
    )

    if not record:
        raise HTTPException(
            status_code=404,
            detail="Processing record not found",
        )

    require_cycle_access(
        db,
        current_user,
        record.broiler_cycle_id,
    )

    db.delete(record)
    db.commit()

    return {"ok": True}