from sqlalchemy import text

from app.db import engine


SQL_COMMANDS = [
    """
    ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)
    """,
    """
    ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT TRUE
    """,
    """
    ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS password_changed_at TIMESTAMP NULL
    """,
    """
    ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP NULL
    """,
    """
    ALTER TABLE app_users
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    """,
]


def main() -> None:
    try:
        with engine.begin() as connection:
            for command in SQL_COMMANDS:
                connection.execute(text(command))

        print("")
        print("SUCCESS: Login columns were added to app_users.")
        print("Existing users and data were preserved.")

    except Exception as error:
        print("")
        print("ERROR: Could not update app_users.")
        print(error)
        raise


if __name__ == "__main__":
    main()