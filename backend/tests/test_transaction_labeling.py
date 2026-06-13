from datetime import date
from decimal import Decimal
import json
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.database import Account, Label, Transaction, TransactionLabelRule, engine, init_db
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


def test_creates_account_scoped_controllability_labels() -> None:
    client = TestClient(app)
    account = create_account(f"Scoped Label Account {uuid4()}")

    response = client.post(
        "/labels",
        json={"name": "Loan Payment", "account_id": account.id, "is_controllable": False},
    )

    assert response.status_code == 201
    assert response.json()["name"] == "Loan Payment"
    assert response.json()["account_id"] == account.id
    assert response.json()["account_name"] == account.name
    assert response.json()["is_controllable"] is False


def test_allows_same_label_name_scope_with_different_control_type() -> None:
    client = TestClient(app)
    account = create_account(f"Duplicate Control Account {uuid4()}")

    controllable_response = client.post(
        "/labels",
        json={"name": "Auto", "account_id": account.id, "is_controllable": True},
    )
    non_controllable_response = client.post(
        "/labels",
        json={"name": "Auto", "account_id": account.id, "is_controllable": False},
    )
    duplicate_response = client.post(
        "/labels",
        json={"name": "Auto", "account_id": account.id, "is_controllable": False},
    )

    assert controllable_response.status_code == 201
    assert non_controllable_response.status_code == 201
    assert controllable_response.json()["slug"] != non_controllable_response.json()["slug"]
    assert duplicate_response.status_code == 409


def test_regex_rules_can_preview_and_apply_specific_descriptions() -> None:
    client = TestClient(app)
    account = create_account(f"Regex Label Account {uuid4()}")
    groceries_response = client.post(
        "/labels",
        json={"name": f"Safeway Grocery {uuid4()}", "account_id": account.id, "is_controllable": True},
    )
    auto_response = client.post(
        "/labels",
        json={"name": f"Safeway Gas {uuid4()}", "account_id": account.id, "is_controllable": True},
    )
    assert groceries_response.status_code == 201
    assert auto_response.status_code == 201
    groceries_id = groceries_response.json()["id"]
    auto_id = auto_response.json()["id"]
    with Session(engine) as session:
        session.add(
            Transaction(
                account_id=account.id or 0,
                transaction_date=date.fromisoformat("2026-07-01"),
                transaction_month="2026-07",
                description="SAFEWAY STORE 123",
                normalized_description=normalize_description("SAFEWAY STORE 123"),
                merchant="SAFEWAY",
                amount=Decimal("42.00"),
                direction="debit",
                duplicate_fingerprint=f"regex-grocery-{uuid4()}",
            )
        )
        session.add(
            Transaction(
                account_id=account.id or 0,
                transaction_date=date.fromisoformat("2026-07-02"),
                transaction_month="2026-07",
                description="SAFEWAY GAS 456",
                normalized_description=normalize_description("SAFEWAY GAS 456"),
                merchant="SAFEWAY GAS",
                amount=Decimal("55.00"),
                direction="debit",
                duplicate_fingerprint=f"regex-gas-{uuid4()}",
            )
        )
        session.commit()

    preview_response = client.get(
        "/transaction-label-rules/matches",
        params={"match_type": "regex", "pattern": "^SAFEWAY(?! GAS)", "label_id": groceries_id},
    )
    rule_response = client.post(
        "/transaction-label-rules",
        json={"label_id": groceries_id, "match_type": "regex", "pattern": "^SAFEWAY(?! GAS)"},
    )
    gas_rule_response = client.post(
        "/transaction-label-rules",
        json={"label_id": auto_id, "match_type": "regex", "pattern": "^SAFEWAY GAS"},
    )

    assert preview_response.status_code == 200
    assert preview_response.json()["total_count"] == 1
    assert rule_response.status_code == 201
    assert rule_response.json()["applied_count"] == 1
    assert gas_rule_response.status_code == 201
    assert gas_rule_response.json()["applied_count"] == 1


def test_account_scoped_rules_do_not_apply_to_other_accounts() -> None:
    client = TestClient(app)
    first_account = create_account(f"Scoped Rule First {uuid4()}")
    second_account = create_account(f"Scoped Rule Second {uuid4()}")
    uncategorized_id = label_id("uncategorized")
    label_response = client.post(
        "/labels",
        json={"name": f"Scoped Auto {uuid4()}", "account_id": first_account.id, "is_controllable": True},
    )
    assert label_response.status_code == 201
    auto_id = label_response.json()["id"]
    description = f"Loan Payment {uuid4()}"
    with Session(engine) as session:
        for account in (first_account, second_account):
            session.add(
                Transaction(
                    account_id=account.id or 0,
                    transaction_date=date.fromisoformat("2026-08-01"),
                    transaction_month="2026-08",
                    description=description,
                    normalized_description=normalize_description(description),
                    merchant="Loan Servicer",
                    amount=Decimal("250.00"),
                    direction="debit",
                    duplicate_fingerprint=f"scoped-rule-{account.id}-{uuid4()}",
                )
            )
        session.commit()

    response = client.post(
        "/transaction-label-rules",
        json={"label_id": auto_id, "pattern": description},
    )

    assert response.status_code == 201
    assert response.json()["applied_count"] == 1
    with Session(engine) as session:
        first_transaction = session.exec(select(Transaction).where(Transaction.account_id == first_account.id, Transaction.description == description)).one()
        second_transaction = session.exec(select(Transaction).where(Transaction.account_id == second_account.id, Transaction.description == description)).one()
    assert first_transaction.label_id == auto_id
    assert second_transaction.label_id in {None, uncategorized_id}


def test_updates_and_deletes_label_rules() -> None:
    client = TestClient(app)
    account = create_account(f"Editable Rule Account {uuid4()}")
    dining_id = label_id("dining")
    groceries_id = label_id("groceries")
    description = f"Editable Coffee {uuid4()}"
    with Session(engine) as session:
        transaction = Transaction(
            account_id=account.id or 0,
            transaction_date=date.fromisoformat("2026-09-01"),
            transaction_month="2026-09",
            description=description,
            normalized_description=normalize_description(description),
            merchant="Coffee shop",
            amount=Decimal("7.00"),
            direction="debit",
            duplicate_fingerprint=f"editable-rule-{uuid4()}",
        )
        session.add(transaction)
        session.commit()

    create_response = client.post(
        "/transaction-label-rules",
        json={"label_id": dining_id, "match_type": "contains", "pattern": "Cafe"},
    )
    assert create_response.status_code == 201
    rule_id = create_response.json()["id"]

    update_response = client.put(
        f"/transaction-label-rules/{rule_id}",
        json={"label_id": groceries_id, "match_type": "regex", "pattern": description},
    )

    assert update_response.status_code == 200
    assert update_response.json()["label_id"] == groceries_id
    assert update_response.json()["match_type"] == "regex"
    assert update_response.json()["pattern"] == description
    assert update_response.json()["applied_count"] == 1
    with Session(engine) as session:
        transaction = session.exec(select(Transaction).where(Transaction.description == description)).one()
    assert transaction.label_id == groceries_id

    delete_response = client.delete(f"/transaction-label-rules/{rule_id}")

    assert delete_response.status_code == 204
    with Session(engine) as session:
        assert session.get(TransactionLabelRule, rule_id) is None


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
        json={"label_id": groceries_id, "pattern": "market basket"},
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
        json={"label_id": subscriptions_id, "pattern": merchant},
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
