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
    if settings.demo_mode:
        seed_demo_data(database_engine)


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
        "CREATE INDEX IF NOT EXISTS ix_transactions_upload_date ON transactions (upload_file_id, transaction_date)",
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


def demo_transaction_fingerprint(account_id: int, transaction_date: date, description: str, amount: Decimal, direction: str) -> str:
    source = "|".join(
        [
            str(account_id),
            transaction_date.isoformat(),
            " ".join(description.casefold().split()),
            str(amount.quantize(Decimal("0.01"))),
            direction,
        ]
    )
    import hashlib

    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def seed_demo_data(database_engine=engine) -> None:
    with Session(database_engine) as session:
        existing_demo = session.exec(select(Account).where(Account.name == "Demo Checking")).first()
        if existing_demo is not None:
            return

        accounts = {
            "checking": Account(name="Demo Checking", institution="Demo Credit Union", account_type="checking"),
            "savings": Account(name="Demo Savings", institution="Demo Credit Union", account_type="savings"),
            "card": Account(name="Demo Rewards Card", institution="Demo Card Bank", account_type="credit card"),
        }
        session.add_all(accounts.values())
        session.commit()
        for account in accounts.values():
            session.refresh(account)

        labels_by_slug = {label.slug: label for label in session.exec(select(Label)).all()}

        def ensure_label(slug: str, name: str, is_controllable: bool, account: Account | None = None) -> Label:
            label = labels_by_slug.get(slug)
            if label is None:
                label = Label(
                    slug=slug,
                    name=name,
                    account_id=account.id if account is not None else None,
                    is_controllable=is_controllable,
                    is_system=False,
                )
                session.add(label)
                session.commit()
                session.refresh(label)
                labels_by_slug[slug] = label
            return label

        labels = {
            "rent": ensure_label("demo-rent", "Rent", False),
            "insurance": ensure_label("demo-insurance", "Insurance", False),
            "travel": ensure_label("demo-travel", "Travel", True),
            "fitness": ensure_label("demo-fitness", "Fitness", True),
            "hobbies": ensure_label("demo-hobbies", "Hobbies", True),
            "savings": ensure_label("demo-savings", "Savings", False, accounts["savings"]),
            "groceries": labels_by_slug["groceries"],
            "paychecks": labels_by_slug["paychecks"],
            "utilities": labels_by_slug["utilities"],
            "transportation": labels_by_slug["auto"],
            "subscriptions": labels_by_slug["subscriptions"],
            "dining": labels_by_slug["dining"],
            "entertainment": labels_by_slug["life"],
            "uncategorized": labels_by_slug["uncategorized"],
        }

        upload = UploadFile(
            account_id=accounts["checking"].id,
            original_filename="demo-seeded-checking.csv",
            content_type="text/csv",
            row_count=81,
            status="imported",
            created_at=datetime(2026, 6, 20, tzinfo=timezone.utc),
        )
        session.add(upload)
        session.commit()
        session.refresh(upload)

        def add_tx(account_key: str, tx_date: str, description: str, merchant: str | None, amount: str, direction: str, label_key: str | None, source_category: str) -> None:
            account = accounts[account_key]
            assert account.id is not None
            transaction_date = date.fromisoformat(tx_date)
            decimal_amount = Decimal(amount).quantize(Decimal("0.01"))
            session.add(
                Transaction(
                    account_id=account.id,
                    upload_file_id=upload.id,
                    label_id=labels[label_key].id if label_key is not None else None,
                    transaction_date=transaction_date,
                    transaction_month=tx_date[:7],
                    description=description,
                    normalized_description=" ".join(description.casefold().split()),
                    merchant=merchant,
                    amount=decimal_amount,
                    direction=direction,
                    source_type="Demo seed",
                    source_category=source_category,
                    duplicate_fingerprint=demo_transaction_fingerprint(account.id, transaction_date, description, decimal_amount, direction),
                )
            )

        for month in ("2026-04", "2026-05", "2026-06"):
            add_tx("checking", f"{month}-01", "Demo Payroll Deposit", "Acme Software Payroll", "4166.67", "credit", "paychecks", "Income")
            add_tx("checking", f"{month}-15", "Demo Payroll Deposit", "Acme Software Payroll", "4166.67", "credit", "paychecks", "Income")
            add_tx("checking", f"{month}-02", "Demo Apartment Rent", "Cedar Street Apartments", "1825.00", "debit", "rent", "Housing")
            add_tx("checking", f"{month}-03", "Demo Electric Utility", "Metro Electric", "96.40", "debit", "utilities", "Utilities")
            add_tx("checking", f"{month}-04", "Demo Fiber Internet", "City Fiber", "65.00", "debit", "utilities", "Utilities")
            add_tx("checking", f"{month}-05", "Demo Transit Pass", "Metro Transit", "88.00", "debit", "transportation", "Transportation")
            add_tx("checking", f"{month}-06", "Demo Renters Insurance", "Harbor Mutual", "18.75", "debit", "insurance", "Insurance")
            add_tx("checking", f"{month}-07", "Demo Transfer To Savings", "Demo Credit Union", "700.00", "debit", "savings", "Savings")
            add_tx("savings", f"{month}-07", "Demo Savings Transfer", "Demo Credit Union", "700.00", "credit", "savings", "Savings")
            add_tx("card", f"{month}-08", "Demo Grocery Run", "Green Basket Market", "142.18", "debit", "groceries", "Groceries")
            add_tx("card", f"{month}-10", "Demo Phone Bill", "Signal Mobile", "52.00", "debit", "utilities", "Utilities")
            add_tx("card", f"{month}-12", "Demo Streaming Bundle", "StreamBox", "23.99", "debit", "subscriptions", "Subscriptions")
            add_tx("card", f"{month}-13", "Demo Gym Membership", "Peak Fitness", "58.00", "debit", "fitness", "Fitness")
            add_tx("card", f"{month}-14", "Demo Dinner With Friends", "Northside Tacos", "46.25", "debit", "dining", "Dining")
            add_tx("card", f"{month}-18", "Demo Movie Night", "Riverside Cinema", "31.50", "debit", "entertainment", "Entertainment")
            add_tx("card", f"{month}-21", "Demo Weekend Trail Gear", "Trailhead Supply", "84.20", "debit", "hobbies", "Hobbies")
            add_tx("card", f"{month}-24", "Demo Travel Fund Flight", "Sample Airlines", "260.00", "debit", "travel", "Travel")
            add_tx("card", f"{month}-27", "Demo Corner Shop", "Corner Shop", "19.44", "debit", None, "Uncategorized")

        session.add(
            TransactionLabelRule(
                label_id=labels["groceries"].id or 0,
                account_id=accounts["card"].id,
                match_field="description",
                match_type="contains",
                pattern="Grocery",
                created_at=datetime(2026, 6, 20, tzinfo=timezone.utc),
            )
        )
        session.commit()


def check_database() -> bool:
    with Session(engine) as session:
        session.exec(text("SELECT 1"))
    return True
