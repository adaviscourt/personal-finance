from datetime import date
import json
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.database import Account, RawImportRow, Transaction, UploadFile, engine, init_db
from app.main import app, duplicate_fingerprint, normalize_description


def import_template_config() -> dict:
    return {
        "mappings": {
            "date": {"source_column": "Date", "transform": "parse_date"},
            "description": {"source_column": "Description", "transform": "copy_column"},
            "amount": {"source_column": "Amount", "transform": "absolute_numeric"},
            "direction": {
                "source_column": "Amount",
                "transform": "signed_amount_direction",
                "positive_direction": "credit",
                "negative_direction": "debit",
            },
            "source_type": {"source_column": "Type", "transform": "copy_column"},
            "source_category": {"source_column": "Category", "transform": "copy_column"},
            "balance": {"source_column": "Balance", "transform": "parse_numeric"},
            "check_number": {"source_column": "Check", "transform": "copy_column"},
        }
    }


def create_account(name: str) -> Account:
    init_db()
    with Session(engine) as session:
        account = session.exec(select(Account).where(Account.name == name)).first()
        if account is None:
            account = Account(name=name)
            session.add(account)
            session.commit()
            session.refresh(account)
        assert account.id is not None
        return account


def prepare_import(client: TestClient, account_id: int, csv_file: str):
    return client.post(
        "/imports/prepare",
        data={"account_id": str(account_id), "template_config": json.dumps(import_template_config())},
        files={"file": ("statement.csv", csv_file, "text/csv")},
    )


def test_prepare_persists_upload_and_raw_rows_without_transactions() -> None:
    client = TestClient(app)
    account = create_account(f"Issue 6 Prepare Account {uuid4()}")

    response = prepare_import(
        client,
        account.id or 0,
        "Date,Description,Amount,Type,Category,Balance,Check\n2026-01-01,Coffee,-4.50,Sale,Dining,100.00,\n",
    )

    assert response.status_code == 201
    body = response.json()
    assert body["row_count"] == 1
    assert body["transformed_preview"] == [
        {
            "date": "2026-01-01",
            "description": "Coffee",
            "amount": "4.50",
            "direction": "debit",
            "source_type": "Sale",
            "source_category": "Dining",
            "balance": "100.00",
            "check_number": None,
        }
    ]

    with Session(engine) as session:
        upload = session.get(UploadFile, body["upload_file_id"])
        raw_rows = session.exec(select(RawImportRow).where(RawImportRow.upload_file_id == body["upload_file_id"])).all()
        transactions = session.exec(select(Transaction).where(Transaction.upload_file_id == body["upload_file_id"])).all()

    assert upload is not None
    assert upload.status == "prepared"
    assert len(raw_rows) == 1
    assert raw_rows[0].raw_data["Description"] == "Coffee"
    assert transactions == []


def test_prepare_rejects_missing_account_before_storing_rows() -> None:
    init_db()
    client = TestClient(app)
    with Session(engine) as session:
        upload_count = len(session.exec(select(UploadFile)).all())

    response = prepare_import(
        client,
        999_999,
        "Date,Description,Amount,Type,Category,Balance,Check\n2026-01-01,Coffee,-4.50,Sale,Dining,100.00,\n",
    )

    assert response.status_code == 404
    assert response.json() == {"detail": "Account not found."}
    with Session(engine) as session:
        assert len(session.exec(select(UploadFile)).all()) == upload_count


def test_confirm_import_inserts_unified_transactions_with_source_links() -> None:
    client = TestClient(app)
    account = create_account(f"Issue 6 Confirm Account {uuid4()}")
    prepare_response = prepare_import(
        client,
        account.id or 0,
        "Date,Description,Amount,Type,Category,Balance,Check\n2026-02-01,Rent,-1200.00,ACH,Housing,900.00,1001\n",
    )
    upload_file_id = prepare_response.json()["upload_file_id"]

    response = client.post(
        "/imports/confirm",
        json={"upload_file_id": upload_file_id, "template_config": import_template_config()},
    )

    assert response.status_code == 200
    assert response.json() == {"upload_file_id": upload_file_id, "inserted_count": 1, "duplicate_candidates": []}
    with Session(engine) as session:
        transaction = session.exec(select(Transaction).where(Transaction.upload_file_id == upload_file_id)).one()
        upload = session.get(UploadFile, upload_file_id)

    assert upload is not None
    assert upload.status == "imported"
    assert transaction.account_id == account.id
    assert transaction.raw_import_row_id is not None
    assert transaction.transaction_date.isoformat() == "2026-02-01"
    assert transaction.transaction_month == "2026-02"
    assert transaction.description == "Rent"
    assert transaction.normalized_description == "rent"
    assert transaction.amount == Decimal("1200.00")
    assert transaction.direction == "debit"
    assert transaction.source_type == "ACH"
    assert transaction.source_category == "Housing"
    assert transaction.balance == Decimal("900.00")
    assert transaction.check_number == "1001"


def test_confirm_import_warns_about_duplicates_before_inserting() -> None:
    client = TestClient(app)
    account = create_account(f"Issue 6 Duplicate Account {uuid4()}")
    normalized_description_value = normalize_description("Coffee Shop")
    with Session(engine) as session:
        transaction_date = date.fromisoformat("2026-03-01")
        existing = Transaction(
            account_id=account.id or 0,
            transaction_date=transaction_date,
            transaction_month="2026-03",
            description="Coffee Shop",
            normalized_description=normalized_description_value,
            amount=Decimal("4.50"),
            direction="debit",
            duplicate_fingerprint=duplicate_fingerprint(
                account.id or 0,
                transaction_date,
                normalized_description_value,
                Decimal("4.50"),
                "debit",
            ),
        )
        session.add(existing)
        session.commit()
        session.refresh(existing)
        existing_id = existing.id

    prepare_response = prepare_import(
        client,
        account.id or 0,
        "Date,Description,Amount,Type,Category,Balance,Check\n2026-03-01, Coffee   Shop ,-4.50,Sale,Dining,,\n",
    )
    upload_file_id = prepare_response.json()["upload_file_id"]
    assert prepare_response.json()["duplicate_candidates"][0]["existing_transaction_id"] == existing_id

    response = client.post(
        "/imports/confirm",
        json={"upload_file_id": upload_file_id, "template_config": import_template_config()},
    )

    assert response.status_code == 200
    assert response.json()["inserted_count"] == 0
    assert response.json()["duplicate_candidates"][0]["row_number"] == 1
    with Session(engine) as session:
        imported_transactions = session.exec(select(Transaction).where(Transaction.upload_file_id == upload_file_id)).all()
        upload = session.get(UploadFile, upload_file_id)

    assert imported_transactions == []
    assert upload is not None
    assert upload.status == "duplicate_warning"
