import os

from app import models
from app.db import SessionLocal
from app.security import hash_password


def main() -> None:
    email = os.getenv("ADMIN_EMAIL", "").strip().lower()
    password = os.getenv("ADMIN_PASSWORD", "").strip()
    full_name = os.getenv("ADMIN_FULL_NAME", "JJ Maritz").strip()

    if not email:
        raise RuntimeError("ADMIN_EMAIL is not set.")

    if not password:
        raise RuntimeError("ADMIN_PASSWORD is not set.")

    if len(password) < 8:
        raise RuntimeError("ADMIN_PASSWORD must contain at least 8 characters.")

    db = SessionLocal()

    try:
        user = (
            db.query(models.AppUser)
            .filter(models.AppUser.email == email)
            .first()
        )

        if not user:
            user = models.AppUser(
                full_name=full_name,
                email=email,
                password_hash=hash_password(password),
                active=True,
                is_global_admin=True,
                is_company_admin=True,
                must_change_password=False,
            )
            db.add(user)
            message = f"Created admin user: {email}"
        else:
            user.password_hash = hash_password(password)
            user.active = True
            user.is_global_admin = True
            user.is_company_admin = True
            user.must_change_password = False
            message = f"Updated admin user: {email}"

        db.commit()
        print(message)

    except Exception:
        db.rollback()
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()