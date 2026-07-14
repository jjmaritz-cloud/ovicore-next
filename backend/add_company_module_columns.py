from sqlalchemy import inspect, text
from app.db import engine

MODULE_COLUMNS = [
    ("enable_broilers", True),
    ("enable_breeders", False),
    ("enable_layers", False),
    ("enable_hatchery", False),
    ("enable_processing", False),
]

def main():
    inspector = inspect(engine)
    existing_columns = {column["name"] for column in inspector.get_columns("companies")}

    dialect = engine.dialect.name

    with engine.begin() as connection:
        for column_name, default_value in MODULE_COLUMNS:
            if column_name in existing_columns:
                print(f"Already exists: {column_name}")
                continue

            if dialect == "postgresql":
                default_sql = "TRUE" if default_value else "FALSE"
                sql = f"""
                ALTER TABLE companies
                ADD COLUMN {column_name} BOOLEAN NOT NULL DEFAULT {default_sql}
                """
            else:
                default_sql = "1" if default_value else "0"
                sql = f"""
                ALTER TABLE companies
                ADD COLUMN {column_name} INTEGER NOT NULL DEFAULT {default_sql}
                """

            print(f"Adding column: {column_name}")
            connection.execute(text(sql))

    print("Company module columns migration complete.")

if __name__ == "__main__":
    main()