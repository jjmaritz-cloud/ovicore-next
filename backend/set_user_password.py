from getpass import getpass

from app import models
from app.db import SessionLocal
from app.security import hash_password


def main() -> None:
    email = input("User email: ").strip().lower()

    if not email:
        print("ERROR: Email is required.")
        return

    password = getpass("Temporary password: ")
    confirm_password = getpass("Confirm password: ")

    if password != confirm_password:
        print("ERROR: Passwords do not match.")
        return

    if len(password) < 8:
        print("ERROR: Password must contain at least 8 characters.")
        return

    db = SessionLocal()

    try:
        user = (
            db.query(models.AppUser)
            .filter(models.AppUser.email == email)
            .first()
        )

        if not user:
            print(f"ERROR: No user found for {email}.")
            return

        user.password_hash = hash_password(password)
        user.must_change_password = True
        user.active = True

        db.commit()

        print("")
        print(f"SUCCESS: Temporary password set for {user.full_name}.")
        print("The user will be required to change it after login.")

    except Exception as error:
        db.rollback()
        print("")
        print("ERROR: Password could not be updated.")
        print(error)
        raise

    finally:
        db.close()


if __name__ == "__main__":
    main()