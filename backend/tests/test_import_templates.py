from fastapi.testclient import TestClient
from sqlmodel import Session, col, delete, select

from app.database import Account, ImportTemplate, engine, init_db
from app.main import app


def valid_template_payload(name: str = "Checking CSV", account_id: int | None = None) -> dict:
    return {
        "name": name,
        "account_id": account_id if account_id is not None else ensure_template_account_id(),
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
        session.execute(delete(ImportTemplate))
        for name in names:
            session.execute(delete(ImportTemplate).where(col(ImportTemplate.name) == name))
        session.commit()


def ensure_template_account_id(name: str = "Issue 4 Test Account") -> int:
    init_db()
    with Session(engine) as session:
        account = session.exec(select(Account).where(Account.name == name)).first()
        if account is None:
            account = Account(name=name)
            session.add(account)
            session.commit()
            session.refresh(account)
        assert account.id is not None
        return account.id


def test_create_list_read_update_and_delete_import_template() -> None:
    client = TestClient(app)
    cleanup_template_names("Checking CSV", "Updated Checking CSV")

    create_response = client.post("/import-templates", json=valid_template_payload())

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["name"] == "Checking CSV"
    assert created["account_id"] is not None
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


def test_template_validation_stores_composed_description_parts() -> None:
    client = TestClient(app)
    cleanup_template_names("Composed Description")
    payload = valid_template_payload("Composed Description")
    payload["config"]["mappings"]["description"] = {
        "transform": "compose_description",
        "description_parts": ["Description", "Check No"],
    }

    response = client.post("/import-templates", json=payload)

    assert response.status_code == 201
    assert response.json()["config"]["mappings"]["description"]["description_parts"] == ["Description", "Check No"]


def test_template_validation_rejects_missing_description_parts() -> None:
    client = TestClient(app)
    payload = valid_template_payload("Missing Description Parts")
    payload["config"]["mappings"]["description"] = {
        "transform": "compose_description",
        "description_parts": [],
    }

    response = client.post("/import-templates", json=payload)

    assert response.status_code == 422
    assert "compose_description requires description_parts" in str(response.json())


def test_template_validation_rejects_missing_account() -> None:
    client = TestClient(app)
    payload = valid_template_payload("Missing Account")
    payload["account_id"] = 999_999

    response = client.post("/import-templates", json=payload)

    assert response.status_code == 404
    assert response.json() == {"detail": "Account not found."}


def test_template_validation_rejects_null_account() -> None:
    client = TestClient(app)
    payload = valid_template_payload("Null Account")
    payload["account_id"] = None

    response = client.post("/import-templates", json=payload)

    assert response.status_code == 422


def test_account_filter_includes_only_matching_account_templates() -> None:
    client = TestClient(app)
    cleanup_template_names("First Account Template", "Second Account Template")

    first_account_id = ensure_template_account_id("Issue 4 Test Account")
    second_account_id = ensure_template_account_id("Issue 4 Second Account")

    first_response = client.post("/import-templates", json=valid_template_payload("First Account Template", first_account_id))
    second_response = client.post("/import-templates", json=valid_template_payload("Second Account Template", second_account_id))

    assert first_response.status_code == 201
    assert second_response.status_code == 201

    list_response = client.get(f"/import-templates?account_id={first_account_id}")
    template_names = {template["name"] for template in list_response.json()}

    assert "First Account Template" in template_names
    assert "Second Account Template" not in template_names

    cleanup_template_names("First Account Template", "Second Account Template")
