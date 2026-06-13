from pathlib import Path
from datetime import date, datetime, timezone
from decimal import Decimal
import sqlite3
from typing import Any

from sqlalchemy import CheckConstraint, Column, JSON, event, text
from sqlalchemy.engine import Engine
from sqlmodel import Field, Session, SQLModel, UniqueConstraint, create_engine, select

from app.config import settings


LABEL_TAXONOMY = (
    ("uncategorized", "Uncategorized", True),
    ("housing", "Housing", False),
    ("auto", "Auto", True),
    ("groceries", "Groceries", True),
    ("paychecks", "Paychecks", False),
    ("life", "Life", True),
    ("utilities", "Utilities", True),
    ("dining", "Dining", True),
    ("subscriptions", "Subscriptions", True),
    ("transfers", "Transfers", False),
)
def utc_now() -> datetime:
    return datetime.now(timezone.utc)


class Account(SQLModel, table=True):
    __tablename__ = "accounts"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True, max_length=120)
    institution: str | None = Field(default=None, max_length=120)
    account_type: str | None = Field(default=None, max_length=60)
    created_at: datetime = Field(default_factory=utc_now)


class UploadFile(SQLModel, table=True):
    __tablename__ = "upload_files"

    id: int | None = Field(default=None, primary_key=True)
    account_id: int | None = Field(default=None, foreign_key="accounts.id", index=True)
    original_filename: str = Field(max_length=255)
    content_type: str | None = Field(default=None, max_length=120)
    row_count: int = Field(default=0)
    status: str = Field(default="previewed", max_length=40, index=True)
    created_at: datetime = Field(default_factory=utc_now)


class RawImportRow(SQLModel, table=True):
    __tablename__ = "raw_import_rows"
    __table_args__ = (UniqueConstraint("upload_file_id", "row_number", name="uq_raw_import_rows_upload_row"),)

    id: int | None = Field(default=None, primary_key=True)
    upload_file_id: int = Field(foreign_key="upload_files.id", index=True)
    row_number: int
    raw_data: dict[str, Any] = Field(sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utc_now)


class ImportTemplate(SQLModel, table=True):
    __tablename__ = "import_templates"

    id: int | None = Field(default=None, primary_key=True)
    account_id: int | None = Field(default=None, foreign_key="accounts.id", index=True)
    name: str = Field(index=True, max_length=120)
    config: dict[str, Any] = Field(sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class Label(SQLModel, table=True):
    __tablename__ = "labels"

    id: int | None = Field(default=None, primary_key=True)
    account_id: int | None = Field(default=None, foreign_key="accounts.id", index=True)
    slug: str = Field(index=True, unique=True, max_length=60)
    name: str = Field(max_length=120)
    is_controllable: bool = Field(default=True)
    is_system: bool = Field(default=True)
    created_at: datetime = Field(default_factory=utc_now)


class Transaction(SQLModel, table=True):
    __tablename__ = "transactions"
    __table_args__ = (CheckConstraint("direction IN ('debit', 'credit')", name="ck_transactions_direction"),)

    id: int | None = Field(default=None, primary_key=True)
    account_id: int = Field(foreign_key="accounts.id", index=True)
    upload_file_id: int | None = Field(default=None, foreign_key="upload_files.id", index=True)
    raw_import_row_id: int | None = Field(default=None, foreign_key="raw_import_rows.id", index=True)
    label_id: int | None = Field(default=None, foreign_key="labels.id", index=True)
    label_rule_id: int | None = Field(default=None, foreign_key="transaction_label_rules.id", index=True)
    transaction_date: date = Field(index=True)
    transaction_month: str = Field(index=True, max_length=7)
    description: str
    normalized_description: str = Field(index=True)
    merchant: str | None = Field(default=None, index=True)
    amount: Decimal = Field(decimal_places=2, max_digits=12)
    direction: str = Field(index=True, max_length=6)
    source_type: str | None = Field(default=None, max_length=120)
    source_category: str | None = Field(default=None, max_length=120)
    check_number: str | None = Field(default=None, max_length=60)
    balance: Decimal | None = Field(default=None, decimal_places=2, max_digits=12)
    duplicate_fingerprint: str = Field(index=True, max_length=128)
    created_at: datetime = Field(default_factory=utc_now)


class TransactionLabelRule(SQLModel, table=True):
    __tablename__ = "transaction_label_rules"
    __table_args__ = (CheckConstraint("match_field IN ('merchant', 'description')", name="ck_label_rules_match_field"),)

    id: int | None = Field(default=None, primary_key=True)
    label_id: int = Field(foreign_key="labels.id", index=True)
    account_id: int | None = Field(default=None, foreign_key="accounts.id", index=True)
    match_field: str = Field(index=True, max_length=20)
    match_type: str = Field(default="contains", index=True, max_length=20)
    pattern: str = Field(index=True)
    created_at: datetime = Field(default_factory=utc_now)


def _ensure_sqlite_parent(database_url: str) -> None:
    if not database_url.startswith("sqlite:///"):
        return

    database_path = database_url.removeprefix("sqlite:///")
    if database_path in {":memory:", ""}:
        return

    Path(database_path).parent.mkdir(parents=True, exist_ok=True)


_ensure_sqlite_parent(settings.database_url)
engine = create_engine(settings.database_url, connect_args={"check_same_thread": False})


@event.listens_for(Engine, "connect")
def enable_sqlite_foreign_keys(dbapi_connection, _connection_record) -> None:
    if not isinstance(dbapi_connection, sqlite3.Connection):
        return

    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


def init_db(database_engine=engine) -> None:
    SQLModel.metadata.create_all(database_engine)
    migrate_schema(database_engine)
    create_schema_indexes(database_engine)
    seed_labels(database_engine)


def migrate_schema(database_engine=engine) -> None:
    migrations = {
        "labels": (
            ("account_id", "ALTER TABLE labels ADD COLUMN account_id INTEGER REFERENCES accounts(id)"),
            ("is_controllable", "ALTER TABLE labels ADD COLUMN is_controllable BOOLEAN NOT NULL DEFAULT 1"),
        ),
        "transaction_label_rules": (
            ("account_id", "ALTER TABLE transaction_label_rules ADD COLUMN account_id INTEGER REFERENCES accounts(id)"),
            ("match_type", "ALTER TABLE transaction_label_rules ADD COLUMN match_type VARCHAR(20) NOT NULL DEFAULT 'contains'"),
        ),
        "transactions": (
            ("label_rule_id", "ALTER TABLE transactions ADD COLUMN label_rule_id INTEGER REFERENCES transaction_label_rules(id)"),
        ),
    }

    with Session(database_engine) as session:
        for table_name, table_migrations in migrations.items():
            existing_columns = {row[1] for row in session.exec(text(f"PRAGMA table_info({table_name})")).all()}
            for column_name, statement in table_migrations:
                if column_name not in existing_columns:
                    session.exec(text(statement))
        session.commit()


def create_schema_indexes(database_engine=engine) -> None:
    index_statements = (
        "CREATE INDEX IF NOT EXISTS ix_transactions_lookup ON transactions (account_id, transaction_date)",
        "CREATE INDEX IF NOT EXISTS ix_transactions_duplicate_detection ON transactions (account_id, transaction_date, normalized_description, amount, direction)",
        "CREATE INDEX IF NOT EXISTS ix_transactions_dashboard_month ON transactions (transaction_month, direction, label_id)",
        "CREATE INDEX IF NOT EXISTS ix_transactions_label_rule_id ON transactions (label_rule_id)",
        "CREATE INDEX IF NOT EXISTS ix_label_rules_matching ON transaction_label_rules (match_field, pattern)",
        "CREATE INDEX IF NOT EXISTS ix_label_rules_account_matching ON transaction_label_rules (account_id, match_field, match_type)",
        "CREATE INDEX IF NOT EXISTS ix_labels_account ON labels (account_id, name)",
    )

    with Session(database_engine) as session:
        for statement in index_statements:
            session.exec(text(statement))
        session.commit()


def seed_labels(database_engine=engine) -> None:
    with Session(database_engine) as session:
        for slug, name, is_controllable in LABEL_TAXONOMY:
            existing_label = session.exec(select(Label).where(Label.slug == slug)).first()
            if existing_label is None:
                session.add(Label(slug=slug, name=name, is_controllable=is_controllable))
            elif existing_label.is_system:
                existing_label.is_controllable = is_controllable
                session.add(existing_label)
        session.commit()


def check_database() -> bool:
    with Session(engine) as session:
        session.exec(text("SELECT 1"))
    return True
