# Database setup: create a persistent SQLite engine and session dependency.
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.core.config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Columns added after the first release. create_all() only creates missing tables,
# so an existing gramvision.db keeps working without the owner deleting it.
LATER_COLUMNS = {
    "saved_charts": {
        "source_key": "VARCHAR(60)",
        "source_label": "VARCHAR(160)",
    },
}


def _relax_saved_chart_dataset_id(connection, inspector) -> bool:
    """Charts saved against a built-in dataset carry no dataset_id.

    Older databases declared the column NOT NULL and SQLite cannot drop that
    constraint in place, so the table is rebuilt with its rows carried over.
    """
    columns = inspector.get_columns("saved_charts")
    dataset_column = next((c for c in columns if c["name"] == "dataset_id"), None)
    if not dataset_column or dataset_column.get("nullable", True):
        return False
    carried = ", ".join(c["name"] for c in columns)
    connection.execute(text("ALTER TABLE saved_charts RENAME TO saved_charts_previous"))
    connection.execute(
        text(
            """
            CREATE TABLE saved_charts (
                id INTEGER NOT NULL PRIMARY KEY,
                owner_id INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
                dataset_id INTEGER REFERENCES datasets (id) ON DELETE CASCADE,
                source_key VARCHAR(60),
                source_label VARCHAR(160),
                name VARCHAR(160),
                config_json TEXT NOT NULL,
                created_at DATETIME
            )
            """
        )
    )
    connection.execute(
        text(f"INSERT INTO saved_charts ({carried}) SELECT {carried} FROM saved_charts_previous")
    )
    connection.execute(text("DROP TABLE saved_charts_previous"))
    connection.execute(text("CREATE INDEX IF NOT EXISTS ix_saved_charts_owner_id ON saved_charts (owner_id)"))
    connection.execute(text("CREATE INDEX IF NOT EXISTS ix_saved_charts_dataset_id ON saved_charts (dataset_id)"))
    return True


def ensure_schema() -> list[str]:
    """Add any column introduced after a user's database was first created."""
    applied: list[str] = []
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    with engine.begin() as connection:
        for table, columns in LATER_COLUMNS.items():
            if table not in existing_tables:
                continue
            present = {column["name"] for column in inspector.get_columns(table)}
            for column, definition in columns.items():
                if column not in present:
                    connection.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {definition}"))
                    applied.append(f"{table}.{column}")
        if "saved_charts" in existing_tables:
            inspector = inspect(engine)  # re-read after the ADD COLUMN statements
            if _relax_saved_chart_dataset_id(connection, inspector):
                applied.append("saved_charts.dataset_id (now optional)")
    return applied
