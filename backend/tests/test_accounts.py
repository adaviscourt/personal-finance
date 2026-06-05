from datetime import date
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.database import Account, ImportTemplate, RawImportRow, Transaction, UploadFile, engine, init_db
from app.main import app, duplicate_fingerprint, normalize_description


def test_create_list_and_rename_account_preserves_metadata() -> None:
    init_db()
    client = TestClient(app)
    name = f"Account API {uuid4()}"

    create_response = client.post("/accounts", json={"name": name})

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["name"] == name
    assert created["transaction_count"] == 0

    renamed_name = f"Renamed {uuid4()}"
    rename_response = client.put(f"/accounts/{created['id']}", json={"name": renamed_name})

    assert rename_response.status_code == 200
    assert rename_response.json()["name"] == renamed_name
    assert rename_response.json()["institution"] is None
    assert rename_response.json()["account_type"] is None
    assert any(account["name"] == renamed_name for account in client.get("/accounts").json())


def test_account_unique_name_validation() -> None:
    init_db()
    client = TestClient(app)
    name = f"Unique Account {uuid4()}"

    assert client.post("/accounts", json={"name": name}).status_code == 201
    duplicate_response = client.post("/accounts", json={"name": name})

    assert duplicate_response.status_code == 409
    assert duplicate_response.json() == {"detail": "Account name already exists."}


def test_delete_account_with_transactions_requires_confirmation_and_cascades() -> None:
    init_db()
    client = TestClient(app)
    with Session(engine) as session:
        account = Account(name=f"Delete Account {uuid4()}")
        session.add(account)
        session.commit()
        session.refresh(account)
        assert account.id is not None
        upload = UploadFile(account_id=account.id, original_filename="statement.csv", row_count=1, status="prepared")
        template = ImportTemplate(account_id=account.id, name=f"Delete Template {uuid4()}", config={"mappings": {}})
        session.add(upload)
        session.add(template)
        session.commit()
        session.refresh(upload)
        assert upload.id is not None
        raw_row = RawImportRow(upload_file_id=upload.id, row_number=1, raw_data={"Description": "Coffee"})
        session.add(raw_row)
        session.commit()
        session.refresh(raw_row)
        assert raw_row.id is not None
        transaction_date = date.fromisoformat("2026-01-01")
        normalized_description = normalize_description("Coffee")
        transaction = Transaction(
            account_id=account.id,
            upload_file_id=upload.id,
            raw_import_row_id=raw_row.id,
            transaction_date=transaction_date,
            transaction_month="2026-01",
            description="Coffee",
            normalized_description=normalized_description,
            amount=Decimal("4.50"),
            direction="debit",
            duplicate_fingerprint=duplicate_fingerprint(
                account.id,
                transaction_date,
                normalized_description,
                Decimal("4.50"),
                "debit",
            ),
        )
        session.add(transaction)
        session.commit()
        account_id = account.id
        upload_id = upload.id
        raw_row_id = raw_row.id
        template_id = template.id

    warning_response = client.delete(f"/accounts/{account_id}")

    assert warning_response.status_code == 409
    assert warning_response.json() == {"id": account_id, "transaction_count": 1, "requires_confirmation": True}

    delete_response = client.delete(f"/accounts/{account_id}?confirmed=true")

    assert delete_response.status_code == 204
    with Session(engine) as session:
        assert session.get(Account, account_id) is None
        assert session.get(UploadFile, upload_id) is None
        assert session.get(RawImportRow, raw_row_id) is None
        assert session.get(ImportTemplate, template_id) is None
        assert session.exec(select(Transaction).where(Transaction.account_id == account_id)).all() == []
