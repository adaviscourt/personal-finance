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
                amount=Decimal(amount),
                direction=direction,
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

    response = TestClient(app).get(f"/dashboard/spending-by-label?month={month}")

    assert response.status_code == 200
    assert response.json() == {
        "month": month,
        "labels": [{"label_slug": "uncategorized", "label_name": "Uncategorized", "amount": "12.34"}],
    }


def test_dashboard_returns_empty_state_data_for_month_without_debits() -> None:
    month = "2098-04"
    reset_month(month)
    account = create_account(f"Dashboard empty account {uuid4()}")
    add_transaction(account.id or 0, "2098-04-01", "Paycheck", "1000.00", "credit", "paychecks")

    response = TestClient(app).get(f"/dashboard/spending-by-label?month={month}")

    assert response.status_code == 200
    assert response.json() == {"month": month, "labels": []}
