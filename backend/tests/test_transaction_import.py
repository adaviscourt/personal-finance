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


def split_import_template_config() -> dict:
    return {
        "mappings": {
            "date": {"source_column": "Date", "transform": "parse_date"},
            "description": {"source_column": "Description", "transform": "copy_column"},
            "amount": {"transform": "split_amount", "debit_column": "Debit", "credit_column": "Credit"},
            "direction": {"transform": "split_amount_direction", "debit_column": "Debit", "credit_column": "Credit"},
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


def prepare_split_import(client: TestClient, account_id: int, csv_file: str):
    return client.post(
        "/imports/prepare",
        data={"account_id": str(account_id), "template_config": json.dumps(split_import_template_config())},
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


def test_prepare_supports_split_debit_credit_columns() -> None:
    client = TestClient(app)
    account = create_account(f"Issue Split Prepare Account {uuid4()}")

    response = prepare_split_import(
        client,
        account.id or 0,
        "Date,Description,Debit,Credit\n2026-01-01,Coffee,4.50,\n2026-01-02,Refund,,7.25\n",
    )

    assert response.status_code == 201, response.json()
    assert response.json()["transformed_preview"] == [
        {"date": "2026-01-01", "description": "Coffee", "amount": "4.50", "direction": "debit"},
        {"date": "2026-01-02", "description": "Refund", "amount": "7.25", "direction": "credit"},
    ]


def test_prepare_treats_split_amount_dash_placeholders_as_blank() -> None:
    client = TestClient(app)
    account = create_account(f"Issue Split Dash Account {uuid4()}")

    response = prepare_split_import(
        client,
        account.id or 0,
        "Date,Description,Debit,Credit\n2026-01-01,Coffee,4.50,-\n2026-01-02,Refund,--,7.25\n",
    )

    assert response.status_code == 201, response.json()
    assert [row["direction"] for row in response.json()["transformed_preview"]] == ["debit", "credit"]


def test_prepare_allows_zero_split_amount_values() -> None:
    client = TestClient(app)
    account = create_account(f"Issue Split Zero Account {uuid4()}")

    response = prepare_split_import(
        client,
        account.id or 0,
        "Date,Description,Debit,Credit\n2026-01-01,Adjustment,0.00,\n",
    )

    assert response.status_code == 201, response.json()
    assert response.json()["transformed_preview"] == [
        {"date": "2026-01-01", "description": "Adjustment", "amount": "0.00", "direction": "debit"},
    ]


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


def test_list_import_uploads_summarizes_confirmed_transactions() -> None:
    client = TestClient(app)
    account = create_account(f"Issue Upload Summary Account {uuid4()}")
    prepare_response = prepare_import(
        client,
        account.id or 0,
        "Date,Description,Amount,Type,Category,Balance,Check\n"
        "2026-04-02,Coffee,-4.50,Sale,Dining,,\n"
        "2026-04-05,Payroll,100.00,ACH,Income,,\n",
    )
    upload_file_id = prepare_response.json()["upload_file_id"]

    confirm_response = client.post(
        "/imports/confirm",
        json={"upload_file_id": upload_file_id, "template_config": import_template_config()},
    )
    response = client.get("/imports/uploads")

    assert confirm_response.status_code == 200
    assert response.status_code == 200
    upload_summary = next(upload for upload in response.json() if upload["id"] == upload_file_id)
    assert upload_summary == {
        "id": upload_file_id,
        "original_filename": "statement.csv",
        "account_id": account.id,
        "account_name": account.name,
        "status": "imported",
        "row_count": 2,
        "imported_transaction_count": 2,
        "min_transaction_date": "2026-04-02",
        "max_transaction_date": "2026-04-05",
        "created_at": upload_summary["created_at"],
    }


def test_delete_import_upload_transactions_preserves_upload_and_raw_rows() -> None:
    client = TestClient(app)
    account = create_account(f"Issue Upload Delete Account {uuid4()}")
    prepare_response = prepare_import(
        client,
        account.id or 0,
        "Date,Description,Amount,Type,Category,Balance,Check\n2026-05-01,Coffee,-4.50,Sale,Dining,,\n",
    )
    upload_file_id = prepare_response.json()["upload_file_id"]
    client.post(
        "/imports/confirm",
        json={"upload_file_id": upload_file_id, "template_config": import_template_config()},
    )

    response = client.delete(f"/imports/uploads/{upload_file_id}")

    assert response.status_code == 200
    assert response.json() == {
        "upload_file_id": upload_file_id,
        "deleted_transaction_count": 1,
        "status": "removed",
    }
    with Session(engine) as session:
        upload = session.get(UploadFile, upload_file_id)
        raw_rows = session.exec(select(RawImportRow).where(RawImportRow.upload_file_id == upload_file_id)).all()
        transactions = session.exec(select(Transaction).where(Transaction.upload_file_id == upload_file_id)).all()

    assert upload is not None
    assert upload.status == "removed"
    assert len(raw_rows) == 1
    assert transactions == []


def test_delete_import_upload_transactions_rejects_missing_upload() -> None:
    init_db()
    client = TestClient(app)

    response = client.delete("/imports/uploads/999999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Upload file not found."}
