from fastapi.testclient import TestClient
from sqlmodel import Session, select

from app.config import settings
from app.database import Account, Label, RawImportRow, Transaction, UploadFile, engine, init_db
from app.main import app


def test_non_demo_config_preserves_defaults() -> None:
    settings.demo_mode = False

    response = TestClient(app).get("/config")

    assert response.status_code == 200
    assert response.json() == {"demo_mode": False, "demo_default_month": "2026-06"}


def test_demo_seed_data_is_deterministic_and_synthetic() -> None:
    settings.demo_mode = True
    init_db()
    first_counts = demo_counts()
    init_db()
    second_counts = demo_counts()
    settings.demo_mode = False

    assert first_counts == second_counts
    assert first_counts == {"accounts": 3, "uploads": 1, "transactions": 54}
    with Session(engine) as session:
        account_names = {account.name for account in session.exec(select(Account)).all() if account.name.startswith("Demo")}
        descriptions = [transaction.description for transaction in session.exec(select(Transaction)).all() if transaction.description.startswith("Demo")]
        label = session.exec(select(Label).where(Label.slug == "demo-savings")).one()

    assert account_names == {"Demo Checking", "Demo Savings", "Demo Rewards Card"}
    assert label.account_id is not None
    assert descriptions
    assert all("Austin" not in description and "Davis" not in description for description in descriptions)


def test_demo_upload_rejected_before_raw_rows_are_stored() -> None:
    settings.demo_mode = True
    init_db()
    before_raw_count = raw_row_count()

    response = TestClient(app).post(
        "/imports/prepare",
        data={
            "account_id": "1",
            "template_config": '{"mappings":{"date":{"source_column":"Date","transform":"parse_date"},"description":{"source_column":"Description","transform":"copy_column"},"amount":{"source_column":"Amount","transform":"absolute_numeric"},"direction":{"source_column":"Amount","transform":"signed_amount_direction","positive_direction":"credit","negative_direction":"debit"}}}',
        },
        files={"file": ("personal.csv", "Date,Description,Amount\n2026-01-01,Coffee,-4.50\n", "text/csv")},
    )
    settings.demo_mode = False

    assert response.status_code == 403
    assert response.json()["detail"] == "Public demo mode does not accept personal CSV uploads. Use seeded synthetic data instead."
    assert raw_row_count() == before_raw_count


def demo_counts() -> dict[str, int]:
    with Session(engine) as session:
        return {
            "accounts": len([account for account in session.exec(select(Account)).all() if account.name.startswith("Demo")]),
            "uploads": len([upload for upload in session.exec(select(UploadFile)).all() if upload.original_filename.startswith("demo-")]),
            "transactions": len([transaction for transaction in session.exec(select(Transaction)).all() if transaction.description.startswith("Demo")]),
        }


def raw_row_count() -> int:
    with Session(engine) as session:
        return len(session.exec(select(RawImportRow)).all())
