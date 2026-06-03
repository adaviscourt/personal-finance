import json

from fastapi.testclient import TestClient

from app.main import app


def post_transformed_preview(csv_file: str, template_config: dict):
    client = TestClient(app)
    return client.post(
        "/imports/transformed-preview",
        data={"template_config": json.dumps(template_config)},
        files={"file": ("statement.csv", csv_file, "text/csv")},
    )


def base_template_config(direction_mapping: dict) -> dict:
    return {
        "mappings": {
            "date": {"source_column": "Date", "transform": "parse_date"},
            "description": {"source_column": "Description", "transform": "copy_column"},
            "amount": {"source_column": "Amount", "transform": "absolute_numeric"},
            "direction": direction_mapping,
        }
    }


def test_transformed_preview_applies_signed_amount_direction() -> None:
    response = post_transformed_preview(
        "Date,Description,Amount\n2026-01-01,Coffee,-4.50\n2026-01-02,Paycheck,2500\n",
        base_template_config(
            {
                "source_column": "Amount",
                "transform": "signed_amount_direction",
                "positive_direction": "credit",
                "negative_direction": "debit",
            }
        ),
    )

    assert response.status_code == 200
    assert response.json()["rows"] == [
        {"date": "2026-01-01", "description": "Coffee", "amount": "4.50", "direction": "debit"},
        {"date": "2026-01-02", "description": "Paycheck", "amount": "2500", "direction": "credit"},
    ]


def test_transformed_preview_applies_split_amount_direction() -> None:
    response = post_transformed_preview(
        "Date,Description,Amount,Debit,Credit\n2026-01-01,Coffee,4.50,4.50,\n2026-01-02,Refund,7.25,,7.25\n",
        base_template_config(
            {
                "transform": "split_amount_direction",
                "debit_column": "Debit",
                "credit_column": "Credit",
            }
        ),
    )

    assert response.status_code == 200
    assert [row["direction"] for row in response.json()["rows"]] == ["debit", "credit"]


def test_transformed_preview_applies_value_lookup_direction() -> None:
    response = post_transformed_preview(
        "Date,Description,Amount,Type\n2026-01-01,Coffee,4.50,Sale\n2026-01-02,Refund,7.25,Return\n",
        base_template_config(
            {
                "source_column": "Type",
                "transform": "value_lookup",
                "rules": {"Sale": "debit", "Return": "credit"},
            }
        ),
    )

    assert response.status_code == 200
    assert [row["direction"] for row in response.json()["rows"]] == ["debit", "credit"]


def test_transformed_preview_rejects_unsupported_transform() -> None:
    config = base_template_config(
        {
            "source_column": "Amount",
            "transform": "signed_amount_direction",
            "positive_direction": "credit",
            "negative_direction": "debit",
        }
    )
    config["mappings"]["amount"]["transform"] = "python_eval"

    response = post_transformed_preview("Date,Description,Amount\n2026-01-01,Coffee,-4.50\n", config)

    assert response.status_code == 422
    assert "python_eval" in str(response.json())


def test_transformed_preview_rejects_missing_signed_amount_direction_config() -> None:
    config = base_template_config(
        {
            "source_column": "Amount",
            "transform": "signed_amount_direction",
        }
    )

    response = post_transformed_preview("Date,Description,Amount\n2026-01-01,Coffee,-4.50\n", config)

    assert response.status_code == 422
    assert "signed_amount_direction requires positive_direction and negative_direction" in str(response.json())


def test_transformed_preview_rejects_non_finite_numeric_values() -> None:
    response = post_transformed_preview(
        "Date,Description,Amount\n2026-01-01,Coffee,NaN\n",
        base_template_config(
            {
                "source_column": "Amount",
                "transform": "signed_amount_direction",
                "positive_direction": "credit",
                "negative_direction": "debit",
            }
        ),
    )

    assert response.status_code == 400
    assert response.json() == {"detail": "Could not parse numeric value: NaN"}


def test_unique_values_returns_source_column_values() -> None:
    client = TestClient(app)

    response = client.post(
        "/imports/unique-values",
        data={"source_column": "Type"},
        files={"file": ("statement.csv", "Type\nSale\nReturn\nSale\n\nFee\n", "text/csv")},
    )

    assert response.status_code == 200
    assert response.json() == {"source_column": "Type", "values": ["Fee", "Return", "Sale"]}
