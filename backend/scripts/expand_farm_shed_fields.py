from pathlib import Path
import sys

# Allow this script to import the backend app package when run directly.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from sqlalchemy import text
from app.db import engine


def main() -> None:
    sql_path = Path(__file__).with_name("expand_farm_shed_fields.sql")
    sql_text = sql_path.read_text(encoding="utf-8")

    # Remove whole-line SQL comments before splitting into statements.
    cleaned_lines = [
        line for line in sql_text.splitlines()
        if not line.lstrip().startswith("--")
    ]
    cleaned_sql = "\n".join(cleaned_lines)

    statements = [
        statement.strip()
        for statement in cleaned_sql.split(";")
        if statement.strip()
    ]

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))

    print("Farm and shed database fields updated successfully.")


if __name__ == "__main__":
    main()
