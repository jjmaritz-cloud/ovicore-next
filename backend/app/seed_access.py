from app.db import SessionLocal, engine, Base
from app import models


Base.metadata.create_all(bind=engine)


def seed_access():
    db = SessionLocal()

    try:
        company = (
            db.query(models.Company)
            .filter(models.Company.company_name == "OviCore")
            .first()
        )

        if not company:
            company = models.Company(
                company_name="OviCore",
                trading_name="OviCore",
                active=True,
            )
            db.add(company)
            db.commit()
            db.refresh(company)

        jj = (
            db.query(models.AppUser)
            .filter(models.AppUser.email == "jj@ovicore.com.au")
            .first()
        )

        if not jj:
            jj = models.AppUser(
                company_id=company.id,
                full_name="JJ Maritz",
                email="jj@ovicore.com.au",
                is_global_admin=True,
                is_company_admin=True,
                active=True,
            )
            db.add(jj)

        sam = (
            db.query(models.AppUser)
            .filter(models.AppUser.email == "sam@ovicore.com.au")
            .first()
        )

        if not sam:
            sam = models.AppUser(
                company_id=company.id,
                full_name="Sam",
                email="sam@ovicore.com.au",
                is_global_admin=True,
                is_company_admin=True,
                active=True,
            )
            db.add(sam)

        db.commit()

        print("Access seed complete.")
        print("Created/confirmed OviCore company, JJ admin and Sam admin.")

    finally:
        db.close()


if __name__ == "__main__":
    seed_access()