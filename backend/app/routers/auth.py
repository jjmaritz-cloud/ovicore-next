import os
from datetime import datetime
from typing import Optional
from fastapi.responses import JSONResponse

from fastapi import (
    APIRouter,
    Cookie,
    Depends,
    HTTPException,
    Response,
    status,
)
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app import models
from app.db import get_db
from app.security import (
    ACCESS_TOKEN_EXPIRE_MINUTES,
    create_access_token,
    decode_access_token,
    verify_password,
)


router = APIRouter(
    prefix="/api/auth",
    tags=["Authentication"],
)

COOKIE_NAME = "ovicore_access_token"

COOKIE_SECURE = (
    os.getenv("COOKIE_SECURE", "false")
    .strip()
    .lower()
    == "true"
)


# ---------------------------------------------------------------------
# Request / response models
# ---------------------------------------------------------------------


class LoginRequest(BaseModel):
    email: str
    password: str


class LoginResponse(BaseModel):
    message: str
    must_change_password: bool


class CurrentUserResponse(BaseModel):
    id: int
    company_id: Optional[int] = None
    company_name: Optional[str] = None

    full_name: str
    email: str

    is_global_admin: bool
    is_company_admin: bool
    active: bool
    must_change_password: bool

    enable_broilers: bool = False
    enable_breeders: bool = False
    enable_layers: bool = False
    enable_hatchery: bool = False
    enable_processing: bool = False

    farm_ids: list[int]


# ---------------------------------------------------------------------
# Current user dependency
# ---------------------------------------------------------------------


def get_current_user(
    access_token: Optional[str] = Cookie(
        default=None,
        alias=COOKIE_NAME,
    ),
    db: Session = Depends(get_db),
) -> models.AppUser:
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )

    subject = decode_access_token(access_token)

    if not subject:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired login session",
        )

    try:
        user_id = int(subject)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid login session",
        )

    user = (
        db.query(models.AppUser)
        .filter(
            models.AppUser.id == user_id,
            models.AppUser.active == True,
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found or inactive",
        )

    return user


# ---------------------------------------------------------------------
# Login
# ---------------------------------------------------------------------


@router.post(
    "/login",
    response_model=LoginResponse,
)
def login(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    normalised_email = payload.email.strip().lower()

    user = (
        db.query(models.AppUser)
        .filter(
            models.AppUser.email == normalised_email,
        )
        .first()
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email address or password",
        )

    if not user.active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This user account is inactive",
        )

    if not user.password_hash:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=(
                "This account does not have a password yet. "
                "Please ask an administrator to reset it."
            ),
        )

    if not verify_password(
        payload.password,
        user.password_hash,
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email address or password",
        )

    token = create_access_token(
        subject=str(user.id),
    )

    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    user.last_login_at = datetime.utcnow()

    db.commit()

    return LoginResponse(
        message="Login successful",
        must_change_password=user.must_change_password,
    )


# ---------------------------------------------------------------------
# Current logged-in user
# ---------------------------------------------------------------------


@router.get(
    "/me",
    response_model=CurrentUserResponse,
)
def get_me(
    current_user: models.AppUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company = None

    if current_user.company_id is not None:
        company = (
            db.query(models.Company)
            .filter(
                models.Company.id == current_user.company_id,
            )
            .first()
        )

    farm_ids = [
        row.farm_id
        for row in (
            db.query(models.UserFarmAccess)
            .filter(
                models.UserFarmAccess.user_id == current_user.id,
            )
            .order_by(models.UserFarmAccess.farm_id.asc())
            .all()
        )
    ]

    return CurrentUserResponse(
        id=current_user.id,
        company_id=current_user.company_id,
        company_name=company.company_name if company else None,

        full_name=current_user.full_name,
        email=current_user.email,

        is_global_admin=current_user.is_global_admin,
        is_company_admin=current_user.is_company_admin,
        active=current_user.active,
        must_change_password=current_user.must_change_password,

        enable_broilers=company.enable_broilers if company else False,
        enable_breeders=company.enable_breeders if company else False,
        enable_layers=company.enable_layers if company else False,
        enable_hatchery=company.enable_hatchery if company else False,
        enable_processing=company.enable_processing if company else False,

        farm_ids=farm_ids,
    )


# ---------------------------------------------------------------------
# Logout
# ---------------------------------------------------------------------


@router.post("/logout")
def logout():
    response = JSONResponse(
        content={
            "message": "Logged out successfully",
        },
        status_code=200,
    )

    response.delete_cookie(
        key=COOKIE_NAME,
        path="/",
        secure=COOKIE_SECURE,
        httponly=True,
        samesite="lax",
    )

    response.headers.append(
        "Set-Cookie",
        (
            f"{COOKIE_NAME}=; "
            "Path=/; "
            "Max-Age=0; "
            "Expires=Thu, 01 Jan 1970 00:00:00 GMT; "
            "HttpOnly; "
            "SameSite=Lax"
        ),
    )

    return response