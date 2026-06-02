from fastapi.testclient import TestClient
from sqlmodel import Session, delete, select

from app.database import Account, ImportTemplate, engine, init_db
from app.main import app


def valid_template_payload(name: str = "Checking CSV") -> dict:
    return {
        "name": name,
        "account_id": None,
        "config": {
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
            }
        },
    }


def cleanup_template_names(*names: str) -> None:
    init_db()
    with Session(engine) as session:
        for name in names:
            session.exec(delete(ImportTemplate).where(ImportTemplate.name == name))
        session.commit()


def test_create_list_read_update_and_delete_import_template() -> None:
    client = TestClient(app)
    cleanup_template_names("Checking CSV", "Updated Checking CSV")

    create_response = client.post("/import-templates", json=valid_template_payload())

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["name"] == "Checking CSV"
    assert created["account_id"] is None
    assert created["config"]["mappings"]["direction"]["transform"] == "signed_amount_direction"

    list_response = client.get("/import-templates")
    assert list_response.status_code == 200
    assert any(template["id"] == created["id"] for template in list_response.json())

    read_response = client.get(f"/import-templates/{created['id']}")
    assert read_response.status_code == 200
    assert read_response.json()["id"] == created["id"]

    update_payload = valid_template_payload("Updated Checking CSV")
    update_payload["config"]["mappings"]["amount"] = {
        "source_column": "Debit",
        "transform": "parse_numeric",
    }
    update_response = client.put(f"/import-templates/{created['id']}", json=update_payload)
    assert update_response.status_code == 200
    assert update_response.json()["name"] == "Updated Checking CSV"
    assert update_response.json()["config"]["mappings"]["amount"]["source_column"] == "Debit"

    delete_response = client.delete(f"/import-templates/{created['id']}")
    assert delete_response.status_code == 204
    assert client.get(f"/import-templates/{created['id']}").status_code == 404


def test_template_validation_rejects_missing_required_mappings() -> None:
    client = TestClient(app)
    payload = valid_template_payload("Missing Direction")
    del payload["config"]["mappings"]["direction"]

    response = client.post("/import-templates", json=payload)

    assert response.status_code == 422
    assert "Missing required mappings" in str(response.json())


def test_template_validation_rejects_unknown_transform() -> None:
    client = TestClient(app)
    payload = valid_template_payload("Bad Transform")
    payload["config"]["mappings"]["amount"]["transform"] = "python_eval"

    response = client.post("/import-templates", json=payload)

    assert response.status_code == 422


def test_account_filter_includes_global_and_matching_account_templates() -> None:
    client = TestClient(app)
    cleanup_template_names("Global Template", "Account Template")

    with Session(engine) as session:
        account = Account(name="Issue 4 Test Account")
        existing_account = session.exec(select(Account).where(Account.name == account.name)).first()
        if existing_account is not None:
            account = existing_account
        else:
            session.add(account)
            session.commit()
            session.refresh(account)

    global_response = client.post("/import-templates", json=valid_template_payload("Global Template"))
    account_payload = valid_template_payload("Account Template")
    account_payload["account_id"] = account.id
    account_response = client.post("/import-templates", json=account_payload)

    assert global_response.status_code == 201
    assert account_response.status_code == 201

    list_response = client.get(f"/import-templates?account_id={account.id}")
    template_names = {template["name"] for template in list_response.json()}

    assert "Global Template" in template_names
    assert "Account Template" in template_names

    cleanup_template_names("Global Template", "Account Template")
