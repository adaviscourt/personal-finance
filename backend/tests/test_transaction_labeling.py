from datetime import date
from decimal import Decimal
import json
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.database import Account, Label, Transaction, engine, init_db
from app.main import app, duplicate_fingerprint, normalize_description


def create_account(name: str) -> Account:
    init_db()
    with Session(engine) as session:
        account = Account(name=name)
        session.add(account)
        session.commit()
        session.refresh(account)
        assert account.id is not None
        return account


def label_id(slug: str) -> int:
    init_db()
    with Session(engine) as session:
        label = session.exec(select(Label).where(Label.slug == slug)).one()
        assert label.id is not None
        return label.id


def import_template_config() -> dict:
    return {
        "mappings": {
            "date": {"source_column": "Date", "transform": "parse_date"},
            "description": {"source_column": "Description", "transform": "copy_column"},
            "merchant": {"source_column": "Merchant", "transform": "copy_column"},
            "amount": {"source_column": "Amount", "transform": "absolute_numeric"},
            "direction": {
                "source_column": "Amount",
                "transform": "signed_amount_direction",
                "positive_direction": "credit",
                "negative_direction": "debit",
            },
        }
    }


def prepare_import(client: TestClient, account_id: int, csv_file: str):
    return client.post(
        "/imports/prepare",
        data={"account_id": str(account_id), "template_config": json.dumps(import_template_config())},
        files={"file": ("statement.csv", csv_file, "text/csv")},
    )


def test_lists_fixed_labels_and_existing_rules() -> None:
    client = TestClient(app)
    dining_id = label_id("dining")
    pattern = f"label-list-{uuid4()}"
    create_response = client.post(
        "/transaction-label-rules",
        json={"label_id": dining_id, "match_field": "description", "pattern": pattern},
    )
    assert create_response.status_code == 201

    labels_response = client.get("/labels")
    rules_response = client.get("/transaction-label-rules")

    assert labels_response.status_code == 200
    assert {label["slug"] for label in labels_response.json()} >= {"uncategorized", "dining", "groceries"}
    assert rules_response.status_code == 200
    assert any(rule["pattern"] == pattern and rule["label_slug"] == "dining" for rule in rules_response.json())


def test_rejects_label_rules_for_unknown_labels() -> None:
    client = TestClient(app)

    response = client.post(
        "/transaction-label-rules",
        json={"label_id": 999999, "match_field": "description", "pattern": "Custom label"},
    )

    assert response.status_code == 404


def test_new_rule_applies_to_matching_existing_transactions() -> None:
    client = TestClient(app)
    account = create_account(f"Issue 7 Existing Account {uuid4()}")
    groceries_id = label_id("groceries")
    dining_id = label_id("dining")
    description = f"Market Basket {uuid4()}"
    normalized_description_value = normalize_description(description)
    with Session(engine) as session:
        transaction_date = date.fromisoformat("2026-04-01")
        transaction = Transaction(
            account_id=account.id or 0,
            transaction_date=transaction_date,
            transaction_month="2026-04",
            description=description,
            normalized_description=normalized_description_value,
            merchant="Market Basket",
            amount=Decimal("32.10"),
            direction="debit",
            duplicate_fingerprint=duplicate_fingerprint(
                account.id or 0,
                transaction_date,
                normalized_description_value,
                Decimal("32.10"),
                "debit",
            ),
        )
        labeled_transaction = Transaction(
            account_id=account.id or 0,
            transaction_date=transaction_date,
            transaction_month="2026-04",
            description=f"Already labeled {description}",
            normalized_description=normalize_description(f"Already labeled {description}"),
            merchant="Market Basket",
            label_id=dining_id,
            amount=Decimal("18.22"),
            direction="debit",
            duplicate_fingerprint=duplicate_fingerprint(
                account.id or 0,
                transaction_date,
                normalize_description(f"Already labeled {description}"),
                Decimal("18.22"),
                "debit",
            ),
        )
        session.add(transaction)
        session.add(labeled_transaction)
        session.commit()
        session.refresh(transaction)
        session.refresh(labeled_transaction)
        transaction_id = transaction.id
        labeled_transaction_id = labeled_transaction.id

    response = client.post(
        "/transaction-label-rules",
        json={"label_id": groceries_id, "match_field": "merchant", "pattern": "market basket"},
    )

    assert response.status_code == 201
    assert response.json()["applied_count"] >= 1
    with Session(engine) as session:
        updated_transaction = session.get(Transaction, transaction_id)
        preserved_transaction = session.get(Transaction, labeled_transaction_id)
    assert updated_transaction is not None
    assert updated_transaction.label_id == groceries_id
    assert preserved_transaction is not None
    assert preserved_transaction.label_id == dining_id


def test_saved_rules_apply_to_future_imports() -> None:
    client = TestClient(app)
    account = create_account(f"Issue 7 Future Account {uuid4()}")
    subscriptions_id = label_id("subscriptions")
    merchant = f"StreamCo {uuid4()}"
    rule_response = client.post(
        "/transaction-label-rules",
        json={"label_id": subscriptions_id, "match_field": "merchant", "pattern": merchant},
    )
    assert rule_response.status_code == 201
    prepare_response = prepare_import(
        client,
        account.id or 0,
        f"Date,Description,Merchant,Amount\n2026-05-01,{merchant} monthly,{merchant},-12.99\n",
    )
    upload_file_id = prepare_response.json()["upload_file_id"]

    response = client.post(
        "/imports/confirm",
        json={"upload_file_id": upload_file_id, "template_config": import_template_config()},
    )

    assert response.status_code == 200
    with Session(engine) as session:
        transaction = session.exec(select(Transaction).where(Transaction.upload_file_id == upload_file_id)).one()
    assert transaction.label_id == subscriptions_id


def test_unmatched_future_imports_are_uncategorized() -> None:
    client = TestClient(app)
    account = create_account(f"Issue 7 Uncategorized Account {uuid4()}")
    uncategorized_id = label_id("uncategorized")
    merchant = f"No Matching Rule {uuid4()}"
    prepare_response = prepare_import(
        client,
        account.id or 0,
        f"Date,Description,Merchant,Amount\n2026-06-01,{merchant} purchase,{merchant},-8.00\n",
    )
    upload_file_id = prepare_response.json()["upload_file_id"]

    response = client.post(
        "/imports/confirm",
        json={"upload_file_id": upload_file_id, "template_config": import_template_config()},
    )

    assert response.status_code == 200
    with Session(engine) as session:
        transaction = session.exec(select(Transaction).where(Transaction.upload_file_id == upload_file_id)).one()
    assert transaction.label_id == uncategorized_id
