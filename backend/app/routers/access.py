from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app import models, schemas
from app.db import get_db
from app.routers.auth import get_current_user
from app.security import hash_password
from datetime import datetime


router = APIRouter(prefix="/api/access", tags=["Access"])


# ---------------------------------------------------------------------
# Permission helpers
# ---------------------------------------------------------------------


def require_global_admin(user: models.AppUser) -> None:
    if not user.is_global_admin:
        raise HTTPException(
            status_code=403,
            detail="Global Admin access required",
        )


def require_company_admin_or_global(
    user: models.AppUser,
    company_id: int,
) -> None:
    if user.is_global_admin:
        return

    if user.is_company_admin and user.company_id == company_id:
        return

    raise HTTPException(
        status_code=403,
        detail="Company Admin access required",
    )


def user_has_farm_access(
    db: Session,
    user: models.AppUser,
    farm_id: int,
) -> bool:
    if user.is_global_admin:
        return True

    farm = (
        db.query(models.BroilerFarm)
        .filter(models.BroilerFarm.id == farm_id)
        .first()
    )

    if not farm:
        return False

    if user.is_company_admin:
        return farm.company_id == user.company_id

    access = (
        db.query(models.UserFarmAccess)
        .filter(
            models.UserFarmAccess.user_id == user.id,
            models.UserFarmAccess.farm_id == farm_id,
        )
        .first()
    )

    return access is not None


def normalise_email(email: str) -> str:
    return email.strip().lower()


# ---------------------------------------------------------------------
# Companies
# Global Admin sees all companies.
# Other users only see their own company.
# ---------------------------------------------------------------------


@router.post("/companies", response_model=schemas.CompanyOut)
def create_company(
    payload: schemas.CompanyCreate,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_global_admin(current_user)

    company_name = payload.company_name.strip()

    existing = (
        db.query(models.Company)
        .filter(models.Company.company_name == company_name)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Company already exists",
        )

    company = models.Company(
        **payload.model_dump(),
    )

    company.company_name = company_name

    db.add(company)
    db.commit()
    db.refresh(company)

    return company


@router.get("/companies", response_model=list[schemas.CompanyOut])
def list_companies(
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if current_user.is_global_admin:
        return (
            db.query(models.Company)
            .order_by(models.Company.company_name.asc())
            .all()
        )

    if current_user.company_id is None:
        return []

    return (
        db.query(models.Company)
        .filter(models.Company.id == current_user.company_id)
        .order_by(models.Company.company_name.asc())
        .all()
    )


@router.patch(
    "/companies/{company_id}",
    response_model=schemas.CompanyOut,
)
def update_company(
    company_id: int,
    payload: schemas.CompanyPatch,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    require_global_admin(current_user)

    company = (
        db.query(models.Company)
        .filter(models.Company.id == company_id)
        .first()
    )

    if not company:
        raise HTTPException(
            status_code=404,
            detail="Company not found",
        )

    data = payload.model_dump(exclude_unset=True)

    if "company_name" in data and data["company_name"]:
        company_name = data["company_name"].strip()

        duplicate = (
            db.query(models.Company)
            .filter(
                models.Company.company_name == company_name,
                models.Company.id != company_id,
            )
            .first()
        )

        if duplicate:
            raise HTTPException(
                status_code=400,
                detail="Another company with this name already exists",
            )

        data["company_name"] = company_name

    for key, value in data.items():
        setattr(company, key, value)

    db.commit()
    db.refresh(company)

    return company


# ---------------------------------------------------------------------
# Users
# Global Admin can manage users across all companies.
# Company Admin can only manage users in their own company.
# ---------------------------------------------------------------------


@router.post("/users", response_model=schemas.AppUserOut)
def create_user(
    payload: schemas.AppUserCreate,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target_company_id = payload.company_id

    if current_user.is_global_admin:
        if target_company_id is None and not payload.is_global_admin:
            raise HTTPException(
                status_code=400,
                detail="A company is required for non-Global Admin users",
            )

    elif current_user.is_company_admin:
        target_company_id = current_user.company_id

        if target_company_id is None:
            raise HTTPException(
                status_code=400,
                detail="Your account is not linked to a company",
            )

        if payload.is_global_admin:
            raise HTTPException(
                status_code=403,
                detail="Company Admin cannot create Global Admin users",
            )

    else:
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    email = normalise_email(payload.email)

    existing = (
        db.query(models.AppUser)
        .filter(models.AppUser.email == email)
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Email already exists",
        )

    if target_company_id is not None:
        company = (
            db.query(models.Company)
            .filter(models.Company.id == target_company_id)
            .first()
        )

        if not company:
            raise HTTPException(
                status_code=404,
                detail="Company not found",
            )

    try:
        password_hash = hash_password(payload.temporary_password)
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    new_user = models.AppUser(
        company_id=target_company_id,
        full_name=payload.full_name.strip(),
        email=email,
        password_hash=password_hash,
        must_change_password=payload.must_change_password,
        is_global_admin=payload.is_global_admin,
        is_company_admin=payload.is_company_admin,
        active=payload.active,
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    return new_user


@router.get("/users", response_model=list[schemas.AppUserOut])
def list_users(
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.AppUser)

    if current_user.is_global_admin:
        return (
            query
            .order_by(models.AppUser.full_name.asc())
            .all()
        )

    if current_user.is_company_admin:
        return (
            query
            .filter(
                models.AppUser.company_id == current_user.company_id,
                models.AppUser.is_global_admin == False,
            )
            .order_by(models.AppUser.full_name.asc())
            .all()
        )

    return [current_user]


@router.patch(
    "/users/{target_user_id}",
    response_model=schemas.AppUserOut,
)
def update_user(
    target_user_id: int,
    payload: schemas.AppUserPatch,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target_user = (
        db.query(models.AppUser)
        .filter(models.AppUser.id == target_user_id)
        .first()
    )

    if not target_user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    if current_user.is_global_admin:
        pass

    elif (
        current_user.is_company_admin
        and target_user.company_id == current_user.company_id
        and not target_user.is_global_admin
    ):
        if payload.is_global_admin:
            raise HTTPException(
                status_code=403,
                detail="Company Admin cannot grant Global Admin access",
            )

        if (
            payload.company_id is not None
            and payload.company_id != current_user.company_id
        ):
            raise HTTPException(
                status_code=403,
                detail="Company Admin cannot move users to another company",
            )

    else:
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    data = payload.model_dump(exclude_unset=True)

    temporary_password = data.pop("temporary_password", None)

    if "email" in data and data["email"]:
        email = normalise_email(data["email"])

        duplicate = (
            db.query(models.AppUser)
            .filter(
                models.AppUser.email == email,
                models.AppUser.id != target_user_id,
            )
            .first()
        )

        if duplicate:
            raise HTTPException(
                status_code=400,
                detail="Email already exists",
            )

        data["email"] = email

    if "full_name" in data and data["full_name"]:
        data["full_name"] = data["full_name"].strip()

    if not current_user.is_global_admin:
        data["company_id"] = current_user.company_id
        data["is_global_admin"] = False

    if temporary_password:
        try:
            target_user.password_hash = hash_password(
                temporary_password
            )
        except ValueError as error:
            raise HTTPException(
                status_code=400,
                detail=str(error),
            )

        target_user.must_change_password = True

    for key, value in data.items():
        setattr(target_user, key, value)

    db.commit()
    db.refresh(target_user)

    return target_user


# ---------------------------------------------------------------------
# User farm access
# ---------------------------------------------------------------------


@router.post(
    "/user-farms",
    response_model=schemas.UserFarmAccessOut,
)

@router.post(
    "/users/{target_user_id}/reset-password",
    response_model=schemas.AppUserOut,
)
def reset_user_password(
    target_user_id: int,
    payload: schemas.AppUserPasswordReset,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target_user = (
        db.query(models.AppUser)
        .filter(models.AppUser.id == target_user_id)
        .first()
    )

    if not target_user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    if current_user.is_global_admin:
        pass

    elif (
        current_user.is_company_admin
        and target_user.company_id == current_user.company_id
        and not target_user.is_global_admin
    ):
        pass

    else:
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    if len(payload.temporary_password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Temporary password must contain at least 8 characters",
        )

    try:
        target_user.password_hash = hash_password(
            payload.temporary_password
        )
    except ValueError as error:
        raise HTTPException(
            status_code=400,
            detail=str(error),
        )

    target_user.must_change_password = payload.must_change_password
    target_user.password_changed_at = datetime.utcnow()

    db.commit()
    db.refresh(target_user)

    return target_user


@router.delete("/users/{target_user_id}")
def delete_user(
    target_user_id: int,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target_user = (
        db.query(models.AppUser)
        .filter(models.AppUser.id == target_user_id)
        .first()
    )

    if not target_user:
        raise HTTPException(
            status_code=404,
            detail="User not found",
        )

    if target_user.id == current_user.id:
        raise HTTPException(
            status_code=400,
            detail="You cannot delete your own logged-in account",
        )

    if current_user.is_global_admin:
        pass

    elif (
        current_user.is_company_admin
        and target_user.company_id == current_user.company_id
        and not target_user.is_global_admin
    ):
        pass

    else:
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    if target_user.is_global_admin:
        remaining_global_admins = (
            db.query(models.AppUser)
            .filter(
                models.AppUser.is_global_admin == True,
                models.AppUser.active == True,
                models.AppUser.id != target_user_id,
            )
            .count()
        )

        if remaining_global_admins == 0:
            raise HTTPException(
                status_code=400,
                detail="The last active Global Admin cannot be deleted",
            )

    db.delete(target_user)
    db.commit()

    return {
        "deleted": True,
        "id": target_user_id,
        "message": "User deleted successfully",
    }

def assign_user_to_farm(
    payload: schemas.UserFarmAccessCreate,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
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
        raise HTTPException(
            status_code=404,
            detail="Target user not found",
        )

    if not farm:
        raise HTTPException(
            status_code=404,
            detail="Farm not found",
        )

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

        if target_user.is_global_admin:
            raise HTTPException(
                status_code=403,
                detail="Company Admin cannot manage Global Admin access",
            )

    else:
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    if target_user.company_id != farm.company_id:
        raise HTTPException(
            status_code=400,
            detail="User and farm must belong to the same company",
        )

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

    access = models.UserFarmAccess(
        user_id=payload.user_id,
        farm_id=payload.farm_id,
    )

    db.add(access)
    db.commit()
    db.refresh(access)

    return access


@router.get(
    "/user-farms/{target_user_id}",
    response_model=list[schemas.UserFarmAccessOut],
)
def list_user_farms(
    target_user_id: int,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    target_user = (
        db.query(models.AppUser)
        .filter(models.AppUser.id == target_user_id)
        .first()
    )

    if not target_user:
        raise HTTPException(
            status_code=404,
            detail="Target user not found",
        )

    if current_user.is_global_admin:
        pass

    elif (
        current_user.is_company_admin
        and target_user.company_id == current_user.company_id
        and not target_user.is_global_admin
    ):
        pass

    elif current_user.id == target_user.id:
        pass

    else:
        raise HTTPException(
            status_code=403,
            detail="Access denied",
        )

    return (
        db.query(models.UserFarmAccess)
        .filter(
            models.UserFarmAccess.user_id == target_user_id
        )
        .order_by(models.UserFarmAccess.farm_id.asc())
        .all()
    )


@router.delete("/user-farms/{access_id}")
def remove_user_farm_access(
    access_id: int,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    access = (
        db.query(models.UserFarmAccess)
        .filter(models.UserFarmAccess.id == access_id)
        .first()
    )

    if not access:
        raise HTTPException(
            status_code=404,
            detail="Farm access record not found",
        )

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
        and target_user is not None
        and farm is not None
        and target_user.company_id == current_user.company_id
        and farm.company_id == current_user.company_id
        and not target_user.is_global_admin
    ):
        pass

    else:
        raise HTTPException(
            status_code=403,
            detail="Admin access required",
        )

    db.delete(access)
    db.commit()

    return {
        "message": "Farm access removed",
    }


# ---------------------------------------------------------------------
# Flocks
# ---------------------------------------------------------------------


@router.post("/flocks", response_model=schemas.FlockOut)
def create_flock(
    payload: schemas.FlockCreate,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company_id = payload.company_id

    if not current_user.is_global_admin:
        if current_user.company_id is None:
            raise HTTPException(
                status_code=400,
                detail="Your account is not linked to a company",
            )

        company_id = current_user.company_id

    require_company_admin_or_global(
        current_user,
        company_id,
    )

    farm = (
        db.query(models.BroilerFarm)
        .filter(models.BroilerFarm.id == payload.farm_id)
        .first()
    )

    if not farm:
        raise HTTPException(
            status_code=404,
            detail="Farm not found",
        )

    if farm.company_id != company_id:
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
            raise HTTPException(
                status_code=404,
                detail="Shed not found",
            )

        if (
            shed.company_id != company_id
            or shed.farm_id != payload.farm_id
        ):
            raise HTTPException(
                status_code=400,
                detail="Shed does not belong to selected farm/company",
            )

    if not user_has_farm_access(
        db,
        current_user,
        payload.farm_id,
    ):
        raise HTTPException(
            status_code=403,
            detail="No access to selected farm",
        )

    existing = (
        db.query(models.Flock)
        .filter(
            models.Flock.company_id == company_id,
            models.Flock.flock_code == payload.flock_code,
        )
        .first()
    )

    if existing:
        raise HTTPException(
            status_code=400,
            detail="Flock code already exists for company",
        )

    flock = models.Flock(
        company_id=company_id,
        farm_id=payload.farm_id,
        shed_id=payload.shed_id,
        flock_code=payload.flock_code,
        module=payload.module,
        placement_date=payload.placement_date,
        status="Open",
    )

    db.add(flock)
    db.commit()
    db.refresh(flock)

    return flock


@router.get("/flocks", response_model=list[schemas.FlockOut])
def list_flocks(
    farm_id: int | None = None,
    status: str | None = None,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(models.Flock)

    if farm_id is not None:
        query = query.filter(
            models.Flock.farm_id == farm_id
        )

    if status:
        query = query.filter(
            models.Flock.status == status
        )

    if current_user.is_global_admin:
        return (
            query
            .order_by(models.Flock.placement_date.desc())
            .all()
        )

    if current_user.is_company_admin:
        return (
            query
            .filter(
                models.Flock.company_id == current_user.company_id
            )
            .order_by(models.Flock.placement_date.desc())
            .all()
        )

    farm_ids_query = (
        db.query(models.UserFarmAccess.farm_id)
        .filter(
            models.UserFarmAccess.user_id == current_user.id
        )
    )

    return (
        query
        .filter(
            models.Flock.company_id == current_user.company_id,
            models.Flock.farm_id.in_(farm_ids_query),
        )
        .order_by(models.Flock.placement_date.desc())
        .all()
    )


@router.patch(
    "/flocks/{flock_id}",
    response_model=schemas.FlockOut,
)
def update_flock(
    flock_id: int,
    payload: schemas.FlockPatch,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    flock = (
        db.query(models.Flock)
        .filter(models.Flock.id == flock_id)
        .first()
    )

    if not flock:
        raise HTTPException(
            status_code=404,
            detail="Flock not found",
        )

    require_company_admin_or_global(
        current_user,
        flock.company_id,
    )

    if not user_has_farm_access(
        db,
        current_user,
        flock.farm_id,
    ):
        raise HTTPException(
            status_code=403,
            detail="No access to selected farm",
        )

    for key, value in payload.model_dump(
        exclude_unset=True
    ).items():
        setattr(flock, key, value)

    db.commit()
    db.refresh(flock)

    return flock


@router.patch(
    "/flocks/{flock_id}/close",
    response_model=schemas.FlockOut,
)
def close_flock(
    flock_id: int,
    payload: schemas.FlockClose,
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    flock = (
        db.query(models.Flock)
        .filter(models.Flock.id == flock_id)
        .first()
    )

    if not flock:
        raise HTTPException(
            status_code=404,
            detail="Flock not found",
        )

    require_company_admin_or_global(
        current_user,
        flock.company_id,
    )

    if not user_has_farm_access(
        db,
        current_user,
        flock.farm_id,
    ):
        raise HTTPException(
            status_code=403,
            detail="No access to selected farm",
        )

    flock.status = "Closed"
    flock.close_date = payload.close_date

    db.commit()
    db.refresh(flock)

    return flock