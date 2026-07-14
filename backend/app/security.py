from datetime import datetime, timedelta, timezone
import os

from jose import JWTError, jwt
from passlib.context import CryptContext


SECRET_KEY = os.getenv(
    "JWT_SECRET_KEY",
    "change-this-development-secret-before-production",
)

ALGORITHM = "HS256"

ACCESS_TOKEN_EXPIRE_MINUTES = int(
    os.getenv(
        "ACCESS_TOKEN_EXPIRE_MINUTES",
        "480",
    )
)

pwd_context = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
)


def hash_password(password: str) -> str:
    if len(password) < 8:
        raise ValueError(
            "Password must contain at least 8 characters."
        )

    return pwd_context.hash(password)


def verify_password(
    plain_password: str,
    password_hash: str,
) -> bool:
    try:
        return pwd_context.verify(
            plain_password,
            password_hash,
        )
    except Exception:
        return False


def create_access_token(
    subject: str,
    expires_minutes: int | None = None,
) -> str:
    expiry_minutes = (
        expires_minutes
        if expires_minutes is not None
        else ACCESS_TOKEN_EXPIRE_MINUTES
    )

    expires_at = (
        datetime.now(timezone.utc)
        + timedelta(minutes=expiry_minutes)
    )

    payload = {
        "sub": subject,
        "exp": expires_at,
    }

    return jwt.encode(
        payload,
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def decode_access_token(
    token: str,
) -> str | None:
    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        subject = payload.get("sub")

        if not subject:
            return None

        return str(subject)

    except JWTError:
        return None