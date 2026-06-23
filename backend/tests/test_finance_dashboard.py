from datetime import date
from decimal import Decimal
from uuid import uuid4

from fastapi.testclient import TestClient
from sqlalchemy import text
from sqlmodel import Session, select

from app.database import Account, Label, Transaction, engine, init_db
from app.main import app, duplicate_fingerprint, normalize_description


def reset_month(month: str) -> None:
    init_db()
    with Session(engine) as session:
        session.execute(text("DELETE FROM transactions WHERE transaction_month = :month").bindparams(month=month))
        session.commit()


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


def add_transaction(
    account_id: int,
    transaction_date_text: str,
    description: str,
    amount: str,
    direction: str,
    label_slug: str | None,
    merchant: str | None = None,
    source_type: str | None = None,
    source_category: str | None = None,
    check_number: str | None = None,
) -> None:
    transaction_date = date.fromisoformat(transaction_date_text)
    normalized_description = normalize_description(description)
    label = label_id(label_slug) if label_slug is not None else None
    with Session(engine) as session:
        session.add(
            Transaction(
                account_id=account_id,
                label_id=label,
                transaction_date=transaction_date,
                transaction_month=transaction_date_text[:7],
                description=description,
                normalized_description=normalized_description,
                merchant=merchant,
                amount=Decimal(amount),
                direction=direction,
                source_type=source_type,
                source_category=source_category,
                check_number=check_number,
                duplicate_fingerprint=duplicate_fingerprint(
                    account_id,
                    transaction_date,
                    normalized_description,
                    Decimal(amount),
                    direction,
                ),
            )
        )
        session.commit()


def test_dashboard_groups_monthly_debit_totals_by_label() -> None:
    month = "2098-01"
    reset_month(month)
    account = create_account(f"Dashboard grouping account {uuid4()}")
    add_transaction(account.id or 0, "2098-01-03", "Market", "10.00", "debit", "groceries")
    add_transaction(account.id or 0, "2098-01-05", "More market", "15.25", "debit", "groceries")
    add_transaction(account.id or 0, "2098-01-10", "Pizza", "8.00", "debit", "dining")
    add_transaction(account.id or 0, "2098-02-10", "Other month", "99.00", "debit", "dining")

    response = TestClient(app).get(f"/dashboard/spending-by-label?month={month}")

    assert response.status_code == 200
    assert response.json() == {
        "month": month,
        "labels": [
            {"label_slug": "dining", "label_name": "Dining", "amount": "8.00"},
            {"label_slug": "groceries", "label_name": "Groceries", "amount": "25.25"},
        ],
    }


def test_dashboard_excludes_credit_transactions_and_uses_uncategorized_fallback() -> None:
    month = "2098-03"
    reset_month(month)
    account = create_account(f"Dashboard credit account {uuid4()}")
    add_transaction(account.id or 0, "2098-03-01", "Paycheck", "2000.00", "credit", "paychecks")
    add_transaction(account.id or 0, "2098-03-02", "Mystery", "12.34", "debit", None)
    add_transaction(account.id or 0, "2098-03-03", "Known mystery", "1.00", "debit", "uncategorized")

    response = TestClient(app).get(f"/dashboard/spending-by-label?month={month}")

    assert response.status_code == 200
    assert response.json() == {
        "month": month,
        "labels": [{"label_slug": "uncategorized", "label_name": "Uncategorized", "amount": "13.34"}],
    }


def test_dashboard_returns_empty_state_data_for_month_without_debits() -> None:
    month = "2098-04"
    reset_month(month)
    account = create_account(f"Dashboard empty account {uuid4()}")
    add_transaction(account.id or 0, "2098-04-01", "Paycheck", "1000.00", "credit", "paychecks")

    response = TestClient(app).get(f"/dashboard/spending-by-label?month={month}")

    assert response.status_code == 200
    assert response.json() == {"month": month, "labels": []}


def test_dashboard_filters_by_selected_accounts_and_defaults_to_all() -> None:
    month = "2098-05"
    reset_month(month)
    first_account = create_account(f"Dashboard first account {uuid4()}")
    second_account = create_account(f"Dashboard second account {uuid4()}")
    add_transaction(first_account.id or 0, "2098-05-01", "Market", "10.00", "debit", "groceries")
    add_transaction(second_account.id or 0, "2098-05-02", "Pizza", "8.00", "debit", "dining")

    all_response = TestClient(app).get(f"/dashboard/spending-by-label?month={month}")
    filtered_response = TestClient(app).get(
        f"/dashboard/spending-by-label?month={month}&account_ids={first_account.id}"
    )

    assert all_response.status_code == 200
    assert {label["label_name"] for label in all_response.json()["labels"]} == {"Dining", "Groceries"}
    assert filtered_response.status_code == 200
    assert filtered_response.json() == {
        "month": month,
        "labels": [{"label_slug": "groceries", "label_name": "Groceries", "amount": "10.00"}],
    }


def test_dashboard_transaction_list_returns_month_rows_with_display_fields() -> None:
    month = "2098-06"
    reset_month(month)
    account = create_account(f"Dashboard row account {uuid4()}")
    add_transaction(
        account.id or 0,
        "2098-06-02",
        "Local Market",
        "10.50",
        "debit",
        "groceries",
        merchant="Market Co",
        source_type="Card",
        source_category="Food",
        check_number="1002",
    )
    add_transaction(account.id or 0, "2098-07-02", "Next month", "1.00", "debit", "groceries")

    response = TestClient(app).get(f"/dashboard/transactions?month={month}")

    assert response.status_code == 200
    body = response.json()
    assert body["month"] == month
    assert len(body["transactions"]) == 1
    assert body["transactions"][0] == {
        "id": body["transactions"][0]["id"],
        "transaction_date": "2098-06-02",
        "account": {"id": account.id, "name": account.name},
        "description": "Local Market",
        "merchant": "Market Co",
        "label": {"id": label_id("groceries"), "slug": "groceries", "name": "Groceries", "is_controllable": True},
        "direction": "debit",
        "amount": "10.50",
        "source_type": "Card",
        "source_category": "Food",
        "check_number": "1002",
    }


def test_dashboard_transaction_list_filters_by_accounts_and_labels() -> None:
    month = "2098-08"
    reset_month(month)
    first_account = create_account(f"Dashboard tx first {uuid4()}")
    second_account = create_account(f"Dashboard tx second {uuid4()}")
    add_transaction(first_account.id or 0, "2098-08-01", "Market", "10.00", "debit", "groceries")
    add_transaction(first_account.id or 0, "2098-08-02", "Pizza", "8.00", "debit", "dining")
    add_transaction(second_account.id or 0, "2098-08-03", "Other market", "5.00", "debit", "groceries")

    response = TestClient(app).get(
        f"/dashboard/transactions?month={month}&account_ids={first_account.id}&label_slugs=groceries"
    )

    assert response.status_code == 200
    assert [transaction["description"] for transaction in response.json()["transactions"]] == ["Market"]


def test_dashboard_transaction_list_filters_uncategorized_rows() -> None:
    month = "2098-09"
    reset_month(month)
    account = create_account(f"Dashboard uncategorized tx {uuid4()}")
    add_transaction(account.id or 0, "2098-09-01", "No label", "10.00", "debit", None)
    add_transaction(account.id or 0, "2098-09-02", "Explicit uncategorized", "8.00", "debit", "uncategorized")
    add_transaction(account.id or 0, "2098-09-03", "Market", "5.00", "debit", "groceries")

    response = TestClient(app).get(f"/dashboard/transactions?month={month}&label_slugs=uncategorized")

    assert response.status_code == 200
    transactions = response.json()["transactions"]
    assert [transaction["description"] for transaction in transactions] == ["No label", "Explicit uncategorized"]
    assert transactions[0]["label"] == {"id": None, "slug": "uncategorized", "name": "Uncategorized", "is_controllable": True}
    assert transactions[1]["label"] == {
        "id": label_id("uncategorized"),
        "slug": "uncategorized",
        "name": "Uncategorized",
        "is_controllable": True,
    }


def test_dashboard_transaction_list_includes_credits_and_orders_stably() -> None:
    month = "2098-10"
    reset_month(month)
    account = create_account(f"Dashboard credit tx {uuid4()}")
    add_transaction(account.id or 0, "2098-10-02", "Second date", "7.00", "debit", "dining")
    add_transaction(account.id or 0, "2098-10-01", "Paycheck", "100.00", "credit", "paychecks")
    add_transaction(account.id or 0, "2098-10-01", "Same day debit", "3.00", "debit", "groceries")

    response = TestClient(app).get(f"/dashboard/transactions?month={month}")

    assert response.status_code == 200
    transactions = response.json()["transactions"]
    assert [transaction["description"] for transaction in transactions] == ["Paycheck", "Same day debit", "Second date"]
    assert [transaction["direction"] for transaction in transactions] == ["credit", "debit", "debit"]


def test_dashboard_transaction_list_returns_empty_transactions() -> None:
    month = "2098-11"
    reset_month(month)

    response = TestClient(app).get(f"/dashboard/transactions?month={month}")

    assert response.status_code == 200
    assert response.json() == {"month": month, "transactions": []}


def test_dashboard_transaction_list_filters_uncategorized_by_label_id() -> None:
    month = "2098-12"
    reset_month(month)
    account = create_account(f"Dashboard uncategorized id tx {uuid4()}")
    uncategorized_id = label_id("uncategorized")
    add_transaction(account.id or 0, "2098-12-01", "No label", "10.00", "debit", None)
    add_transaction(account.id or 0, "2098-12-02", "Market", "5.00", "debit", "groceries")

    response = TestClient(app).get(f"/dashboard/transactions?month={month}&label_ids={uncategorized_id}")

    assert response.status_code == 200
    assert [transaction["description"] for transaction in response.json()["transactions"]] == ["No label"]


def test_dashboard_transaction_list_filters_controllable_rows() -> None:
    month = "2099-01"
    reset_month(month)
    account = create_account(f"Dashboard controllable tx {uuid4()}")
    add_transaction(account.id or 0, "2099-01-01", "Market", "10.00", "debit", "groceries")
    add_transaction(account.id or 0, "2099-01-02", "Mortgage", "900.00", "debit", "housing")
    add_transaction(account.id or 0, "2099-01-03", "No label", "1.00", "debit", None)

    response = TestClient(app).get(f"/dashboard/transactions?month={month}&controllability=controllable")

    assert response.status_code == 200
    assert [transaction["description"] for transaction in response.json()["transactions"]] == ["Market", "No label"]


def test_dashboard_transaction_list_filters_non_controllable_rows() -> None:
    month = "2099-02"
    reset_month(month)
    account = create_account(f"Dashboard non-controllable tx {uuid4()}")
    add_transaction(account.id or 0, "2099-02-01", "Market", "10.00", "debit", "groceries")
    add_transaction(account.id or 0, "2099-02-02", "Mortgage", "900.00", "debit", "housing")
    add_transaction(account.id or 0, "2099-02-03", "Paycheck", "1000.00", "credit", "paychecks")

    response = TestClient(app).get(f"/dashboard/transactions?month={month}&controllability=non-controllable")

    assert response.status_code == 200
    assert [transaction["description"] for transaction in response.json()["transactions"]] == ["Mortgage", "Paycheck"]


def test_dashboard_transaction_list_both_controllability_keeps_all_display_labels() -> None:
    month = "2099-03"
    reset_month(month)
    account = create_account(f"Dashboard both controllability tx {uuid4()}")
    add_transaction(account.id or 0, "2099-03-01", "Market", "10.00", "debit", "groceries")
    add_transaction(account.id or 0, "2099-03-02", "Mortgage", "900.00", "debit", "housing")
    add_transaction(account.id or 0, "2099-03-03", "No label", "1.00", "debit", None)

    response = TestClient(app).get(f"/dashboard/transactions?month={month}&controllability=both")

    assert response.status_code == 200
    assert [transaction["description"] for transaction in response.json()["transactions"]] == ["Market", "Mortgage", "No label"]
