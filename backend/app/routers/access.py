from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.db import get_db


router = APIRouter(prefix="/api/access", tags=["Access"])


# ---------------------------------------------------------------------
# Temporary current-user helper
# Later this will come from real login/auth.
# For now use ?user_id=1 in API calls.
# ---------------------------------------------------------------------
def get_current_user(user_id: int, db: Session):
    user = (
        db.query(models.AppUser)
        .filter(models.AppUser.id == user_id, models.AppUser.active == True)
        .first()
    )

    if not user:
        raise HTTPException(status_code=401, detail="User not found or inactive")

    return user


def require_global_admin(user: models.AppUser):
    if not user.is_global_admin:
        raise HTTPException(status_code=403, detail="Global Admin access required")


def require_company_admin_or_global(user: models.AppUser, company_id: int):
    if user.is_global_admin:
        return

    if user.is_company_admin and user.company_id == company_id:
        return

    raise HTTPException(status_code=403, detail="Company Admin access required")


def user_has_farm_access(db: Session, user: models.AppUser, farm_id: int) -> bool:
    if user.is_global_admin or user.is_company_admin:
        return True

    access = (
        db.query(models.UserFarmAccess)
        .filter(
            models.UserFarmAccess.user_id == user.id,
            models.UserFarmAccess.farm_id == farm_id,
        )
        .first()
    )

    return access is not None


# ---------------------------------------------------------------------
# Companies
# Global Admin creates companies.
# Company users can only see their own company.
# ---------------------------------------------------------------------
@router.post("/companies", response_model=schemas.CompanyOut)
def create_company(
    payload: schemas.CompanyCreate,
    user_id: int,
    db: Session = Depends(get_db),
):
    user = get_current_user(user_id, db)
    require_global_admin(user)

    existing = (
        db.query(models.Company)
        .filter(models.Company.company_name == payload.company_name)
        .first()
    )

    if existing:
        raise HTTPException(status_code=400, detail="Company already exists")

    company = models.Company(**payload.model_dump())
    db.add(company)
    db.commit()
    db.refresh(company)

    return company


@router.get("/companies", response_model=list[schemas.CompanyOut])
def list_companies(
    user_id: int,
    db: Session = Depends(get_db),
):
    user = get_current_user(user_id, db)

    if user.is_global_admin:
        return db.query(models.Company).order_by(models.Company.company_name).all()

    if user.company_id is None:
        return []

    return (
        db.query(models.Company)
        .filter(models.Company.id == user.company_id)
        .order_by(models.Company.company_name)
        .all()
    )


@router.patch("/companies/{company_id}", response_model=schemas.CompanyOut)
def update_company(
    company_id: int,
    payload: schemas.CompanyPatch,
    user_id: int,
    db: Session = Depends(get_db),
):
    user = get_current_user(user_id, db)
    require_global_admin(user)

    company = db.query(models.Company).filter(models.Company.id == company_id).first()

    if not company:
        raise HTTPException(status_code=404, detail="Company not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(company, key, value)

    db.commit()
    db.refresh(company)

    return company


# ---------------------------------------------------------------------
# Users
# Global Admin can create users for any company.
# Company Admin can create users only inside their own company.
# ---------------------------------------------------------------------
@router.post("/users", response_model=schemas.AppUserOut)
def create_user(
    payload: schemas.AppUserCreate,
    user_id: int,
    db: Session = Depends(get_db),
):
    current_user = get_current_user(user_id, db)

    if current_user.is_global_admin:
        pass
    elif current_user.is_company_admin and payload.company_id == current_user.company_id:
        if payload.is_global_admin:
            raise HTTPException(
                status_code=403,
                detail="Company Admin cannot create Global Admin users",
            )
    else:
        raise HTTPException(status_code=403, detail="Admin access required")

    existing = db.query(models.AppUser).filter(models.AppUser.email == payload.email).first()

    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")

    new_user = models.AppUser(**payload.model_dump())
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.get("/users", response_model=list[schemas.AppUserOut])
def list_users(
    user_id: int,
    db: Session = Depends(get_db),
):
    current_user = get_current_user(user_id, db)

    query = db.query(models.AppUser)

    if current_user.is_global_admin:
        return query.order_by(models.AppUser.full_name).all()

    if current_user.is_company_admin:
        return (
            query.filter(models.AppUser.company_id == current_user.company_id)
            .order_by(models.AppUser.full_name)
            .all()
        )

    return [current_user]


@router.patch("/users/{target_user_id}", response_model=schemas.AppUserOut)
def update_user(
    target_user_id: int,
    payload: schemas.AppUserPatch,
    user_id: int,
    db: Session = Depends(get_db),
):
    current_user = get_current_user(user_id, db)

    target_user = (
        db.query(models.AppUser)
        .filter(models.AppUser.id == target_user_id)
        .first()
    )

    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.is_global_admin:
        pass
    elif current_user.is_company_admin and target_user.company_id == current_user.company_id:
        if payload.is_global_admin:
            raise HTTPException(
                status_code=403,
                detail="Company Admin cannot grant Global Admin access",
            )
    else:
        raise HTTPException(status_code=403, detail="Admin access required")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(target_user, key, value)

    db.commit()
    db.refresh(target_user)

    return target_user


# ---------------------------------------------------------------------
# User farm access
# Global Admin and Company Admin can assign users to farms.
# Company Admin can only assign users/farms inside their own company.
# ---------------------------------------------------------------------
@router.post("/user-farms", response_model=schemas.UserFarmAccessOut)
def assign_user_to_farm(
    payload: schemas.UserFarmAccessCreate,
    user_id: int,
    db: Session = Depends(get_db),
):
    current_user = get_current_user(user_id, db)

    target_user = (
        db.query(models.AppUser)
        .filter(models.AppUser.id == payload.user_id)
        .first()
    )

    farm = (
        db.query(models.BroilerFarm)
        .filter(models.BroilerFarm.id == payload.farm_id)
        .first()
    )

    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    if current_user.is_global_admin:
        pass
    elif current_user.is_company_admin:
        if target_user.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="Cannot assign users outside your company",
            )

        if farm.company_id != current_user.company_id:
            raise HTTPException(
                status_code=403,
                detail="Cannot assign farms outside your company",
            )
    else:
        raise HTTPException(status_code=403, detail="Admin access required")

    existing = (
        db.query(models.UserFarmAccess)
        .filter(
            models.UserFarmAccess.user_id == payload.user_id,
            models.UserFarmAccess.farm_id == payload.farm_id,
        )
        .first()
    )

    if existing:
        return existing

    access = models.UserFarmAccess(**payload.model_dump())
    db.add(access)
    db.commit()
    db.refresh(access)

    return access


@router.get("/user-farms/{target_user_id}", response_model=list[schemas.UserFarmAccessOut])
def list_user_farms(
    target_user_id: int,
    user_id: int,
    db: Session = Depends(get_db),
):
    current_user = get_current_user(user_id, db)

    target_user = (
        db.query(models.AppUser)
        .filter(models.AppUser.id == target_user_id)
        .first()
    )

    if not target_user:
        raise HTTPException(status_code=404, detail="Target user not found")

    if current_user.is_global_admin:
        pass
    elif current_user.is_company_admin and target_user.company_id == current_user.company_id:
        pass
    elif current_user.id == target_user.id:
        pass
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    return (
        db.query(models.UserFarmAccess)
        .filter(models.UserFarmAccess.user_id == target_user_id)
        .order_by(models.UserFarmAccess.farm_id)
        .all()
    )


@router.delete("/user-farms/{access_id}")
def remove_user_farm_access(
    access_id: int,
    user_id: int,
    db: Session = Depends(get_db),
):
    current_user = get_current_user(user_id, db)

    access = (
        db.query(models.UserFarmAccess)
        .filter(models.UserFarmAccess.id == access_id)
        .first()
    )

    if not access:
        raise HTTPException(status_code=404, detail="Farm access record not found")

    target_user = (
        db.query(models.AppUser)
        .filter(models.AppUser.id == access.user_id)
        .first()
    )

    farm = (
        db.query(models.BroilerFarm)
        .filter(models.BroilerFarm.id == access.farm_id)
        .first()
    )

    if current_user.is_global_admin:
        pass
    elif (
        current_user.is_company_admin
        and target_user
        and farm
        and target_user.company_id == current_user.company_id
        and farm.company_id == current_user.company_id
    ):
        pass
    else:
        raise HTTPException(status_code=403, detail="Admin access required")

    db.delete(access)
    db.commit()

    return {"message": "Farm access removed"}


# ---------------------------------------------------------------------
# Flocks
# Company Admin can create and close flocks.
# Global Admin can also create and close flocks.
# Standard users cannot create/close flocks.
# ---------------------------------------------------------------------
@router.post("/flocks", response_model=schemas.FlockOut)
def create_flock(
    payload: schemas.FlockCreate,
    user_id: int,
    db: Session = Depends(get_db),
):
    user = get_current_user(user_id, db)
    require_company_admin_or_global(user, payload.company_id)

    farm = (
        db.query(models.BroilerFarm)
        .filter(models.BroilerFarm.id == payload.farm_id)
        .first()
    )

    if not farm:
        raise HTTPException(status_code=404, detail="Farm not found")

    if farm.company_id != payload.company_id:
        raise HTTPException(
            status_code=400,
            detail="Farm does not belong to selected company",
        )

    if payload.shed_id is not None:
        shed = (
            db.query(models.BroilerShed)
            .filter(models.BroilerShed.id == payload.shed_id)
            .first()
        )

        if not shed:
            raise HTTPException(status_code=404, detail="Shed not found")

        if shed.company_id != payload.company_id or shed.farm_id != payload.farm_id:
            raise HTTPException(
                status_code=400,
                detail="Shed does not belong to selected farm/company",
            )

    if not user_has_farm_access(db, user, payload.farm_id):
        raise HTTPException(status_code=403, detail="No access to selected farm")

    existing = (
        db.query(models.Flock)
        .filter(
            models.Flock.company_id == payload.company_id,
            models.Flock.flock_code == payload.flock_code,
        )
        .first()
    )

    if existing:
        raise HTTPException(status_code=400, detail="Flock code already exists for company")

    flock = models.Flock(**payload.model_dump(), status="Open")
    db.add(flock)
    db.commit()
    db.refresh(flock)

    return flock


@router.get("/flocks", response_model=list[schemas.FlockOut])
def list_flocks(
    user_id: int,
    farm_id: int | None = None,
    status: str | None = None,
    db: Session = Depends(get_db),
):
    user = get_current_user(user_id, db)

    query = db.query(models.Flock)

    if farm_id is not None:
        query = query.filter(models.Flock.farm_id == farm_id)

    if status:
        query = query.filter(models.Flock.status == status)

    if user.is_global_admin:
        return query.order_by(models.Flock.placement_date.desc()).all()

    if user.is_company_admin:
        return (
            query.filter(models.Flock.company_id == user.company_id)
            .order_by(models.Flock.placement_date.desc())
            .all()
        )

    farm_ids = (
        db.query(models.UserFarmAccess.farm_id)
        .filter(models.UserFarmAccess.user_id == user.id)
        .subquery()
    )

    return (
        query.filter(models.Flock.farm_id.in_(farm_ids))
        .order_by(models.Flock.placement_date.desc())
        .all()
    )


@router.patch("/flocks/{flock_id}", response_model=schemas.FlockOut)
def update_flock(
    flock_id: int,
    payload: schemas.FlockPatch,
    user_id: int,
    db: Session = Depends(get_db),
):
    user = get_current_user(user_id, db)

    flock = db.query(models.Flock).filter(models.Flock.id == flock_id).first()

    if not flock:
        raise HTTPException(status_code=404, detail="Flock not found")

    require_company_admin_or_global(user, flock.company_id)

    if not user_has_farm_access(db, user, flock.farm_id):
        raise HTTPException(status_code=403, detail="No access to selected farm")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(flock, key, value)

    db.commit()
    db.refresh(flock)

    return flock


@router.patch("/flocks/{flock_id}/close", response_model=schemas.FlockOut)
def close_flock(
    flock_id: int,
    payload: schemas.FlockClose,
    user_id: int,
    db: Session = Depends(get_db),
):
    user = get_current_user(user_id, db)

    flock = db.query(models.Flock).filter(models.Flock.id == flock_id).first()

    if not flock:
        raise HTTPException(status_code=404, detail="Flock not found")

    require_company_admin_or_global(user, flock.company_id)

    if not user_has_farm_access(db, user, flock.farm_id):
        raise HTTPException(status_code=403, detail="No access to selected farm")

    flock.status = "Closed"
    flock.close_date = payload.close_date

    db.commit()
    db.refresh(flock)

    return flock