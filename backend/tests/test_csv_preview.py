from fastapi.testclient import TestClient

from app.main import MAX_PREVIEW_UPLOAD_BYTES, app


def test_csv_preview_returns_headers_and_first_five_rows() -> None:
    client = TestClient(app)
    csv_file = "Date,Description,Amount\n2026-01-01,Coffee,-4.50\n2026-01-02,Rent,-1200\n2026-01-03,Paycheck,2500\n2026-01-04,Gas,-45\n2026-01-05,Groceries,-82\n2026-01-06,Extra,-1\n"

    response = client.post(
        "/imports/preview",
        files={"file": ("statement.csv", csv_file, "text/csv")},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["headers"] == ["Date", "Description", "Amount"]
    assert body["source_columns"] == ["Date", "Description", "Amount"]
    assert body["rows"] == [
        {"Date": "2026-01-01", "Description": "Coffee", "Amount": "-4.50"},
        {"Date": "2026-01-02", "Description": "Rent", "Amount": "-1200"},
        {"Date": "2026-01-03", "Description": "Paycheck", "Amount": "2500"},
        {"Date": "2026-01-04", "Description": "Gas", "Amount": "-45"},
        {"Date": "2026-01-05", "Description": "Groceries", "Amount": "-82"},
    ]


def test_csv_preview_returns_all_rows_when_fewer_than_five() -> None:
    client = TestClient(app)

    response = client.post(
        "/imports/preview",
        files={"file": ("statement.csv", "Date,Amount\n2026-01-01,-4.50\n", "text/csv")},
    )

    assert response.status_code == 200
    assert response.json()["rows"] == [{"Date": "2026-01-01", "Amount": "-4.50"}]


def test_csv_preview_rejects_invalid_csv_without_creating_importable_rows() -> None:
    client = TestClient(app)

    response = client.post(
        "/imports/preview",
        files={"file": ("statement.csv", 'Date,Amount\n"2026-01-01,-4.50\n', "text/csv")},
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Could not parse CSV file for preview."}


def test_csv_preview_rejects_uploads_over_size_limit() -> None:
    client = TestClient(app)
    csv_file = "Date,Amount\n" + ("2026-01-01,-4.50\n" * ((MAX_PREVIEW_UPLOAD_BYTES // 17) + 1))

    response = client.post(
        "/imports/preview",
        files={"file": ("statement.csv", csv_file, "text/csv")},
    )

    assert response.status_code == 413
    assert response.json() == {"detail": "CSV preview uploads must be 10 MB or smaller."}
