from sqlalchemy import text
from sqlmodel import Session, create_engine, select

from app.database import LABEL_TAXONOMY, Label, init_db


def make_test_engine(tmp_path):
    database_path = tmp_path / "test.db"
    return create_engine(f"sqlite:///{database_path}", connect_args={"check_same_thread": False})


def test_init_db_creates_mvp_schema(tmp_path) -> None:
    engine = make_test_engine(tmp_path)

    init_db(engine)

    expected_tables = {
        "accounts",
        "upload_files",
        "raw_import_rows",
        "import_templates",
        "transactions",
        "labels",
        "transaction_label_rules",
    }
    with Session(engine) as session:
        table_rows = session.exec(
            text("SELECT name FROM sqlite_master WHERE type = 'table'")
        ).all()

    assert expected_tables.issubset({row[0] for row in table_rows})


def test_init_db_seeds_fixed_labels_idempotently(tmp_path) -> None:
    engine = make_test_engine(tmp_path)

    init_db(engine)
    init_db(engine)

    with Session(engine) as session:
        labels = session.exec(select(Label).order_by(Label.slug)).all()

    expected_labels = sorted(LABEL_TAXONOMY)
    assert [(label.slug, label.name) for label in labels] == expected_labels
    assert any(label.slug == "uncategorized" for label in labels)


def test_init_db_creates_lookup_and_matching_indexes(tmp_path) -> None:
    engine = make_test_engine(tmp_path)

    init_db(engine)


    with Session(engine) as session:
        index_rows = session.exec(
            text("SELECT name FROM sqlite_master WHERE type = 'index'")
        ).all()

    index_names = {row[0] for row in index_rows}
    assert "ix_transactions_lookup" in index_names
    assert "ix_transactions_duplicate_detection" in index_names
    assert "ix_transactions_dashboard_month" in index_names
    assert "ix_label_rules_matching" in index_names


def test_duplicate_fingerprint_index_is_not_unique(tmp_path) -> None:
    engine = make_test_engine(tmp_path)

    init_db(engine)

    with Session(engine) as session:
        index_rows = session.exec(text("PRAGMA index_list('transactions')")).all()

    duplicate_index = next(row for row in index_rows if row[1] == "ix_transactions_duplicate_fingerprint")
    assert duplicate_index[2] == 0


def test_sqlite_foreign_keys_are_enforced(tmp_path) -> None:
    engine = make_test_engine(tmp_path)

    init_db(engine)

    with Session(engine) as session:
        foreign_keys_enabled = session.exec(text("PRAGMA foreign_keys")).one()[0]

    assert foreign_keys_enabled == 1
