from contextlib import asynccontextmanager
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
import hashlib
from io import BytesIO
import json
from pathlib import Path
import re
from typing import Any, Literal

import polars as pl
from fastapi import FastAPI, Form, HTTPException, Query, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator
from sqlalchemy import func, or_
from sqlmodel import Session, col, select

from app.database import (
    Account,
    ImportTemplate,
    Label,
    RawImportRow,
    Transaction,
    TransactionLabelRule,
    UploadFile as StoredUploadFile,
    check_database,
    engine,
    init_db,
    utc_now,
)


MAX_PREVIEW_UPLOAD_BYTES = 10 * 1024 * 1024
REQUIRED_TEMPLATE_MAPPINGS = {"date", "description", "amount", "direction"}
STATIC_DIR = Path(__file__).resolve().parent / "static"


class CsvPreviewResponse(BaseModel):
    headers: list[str]
    rows: list[dict[str, Any]]
    source_columns: list[str]


class UniqueValuesResponse(BaseModel):
    source_column: str
    values: list[str]


class TransformedPreviewResponse(BaseModel):
    rows: list[dict[str, Any]]


class TemplateFieldMapping(BaseModel):
    source_column: str | None = None
    transform: Literal[
        "copy_column",
        "parse_date",
        "parse_numeric",
        "absolute_numeric",
        "split_amount",
        "signed_amount_direction",
        "split_amount_direction",
        "value_lookup",
    ]
    rules: dict[str, Literal["debit", "credit"]] | None = None
    positive_direction: Literal["debit", "credit"] | None = None
    negative_direction: Literal["debit", "credit"] | None = None
    debit_column: str | None = None
    credit_column: str | None = None

    @field_validator("source_column", "debit_column", "credit_column")
    @classmethod
    def non_blank_column(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("Column names must not be blank.")
        return value

    @model_validator(mode="after")
    def validate_transform_config(self):
        if self.transform in {"split_amount", "split_amount_direction"}:
            if not self.debit_column or not self.credit_column:
                raise ValueError(f"{self.transform} requires debit_column and credit_column.")
            return self

        if not self.source_column:
            raise ValueError(f"{self.transform} requires source_column.")
        if self.transform == "signed_amount_direction" and (
            self.positive_direction is None or self.negative_direction is None
        ):
            raise ValueError("signed_amount_direction requires positive_direction and negative_direction.")
        if self.transform == "value_lookup" and not self.rules:
            raise ValueError("value_lookup requires rules.")
        return self


class ImportTemplateConfig(BaseModel):
    mappings: dict[str, TemplateFieldMapping]

    @model_validator(mode="after")
    def validate_required_mappings(self):
        missing_fields = sorted(REQUIRED_TEMPLATE_MAPPINGS - set(self.mappings))
        if missing_fields:
            raise ValueError(f"Missing required mappings: {', '.join(missing_fields)}")
        return self


class ImportPrepareResponse(BaseModel):
    upload_file_id: int
    row_count: int
    transformed_preview: list[dict[str, Any]]
    duplicate_candidates: list[dict[str, Any]]


class ConfirmImportPayload(BaseModel):
    upload_file_id: int
    template_config: ImportTemplateConfig
    allow_duplicates: bool = False


class ConfirmImportResponse(BaseModel):
    upload_file_id: int
    inserted_count: int
    duplicate_candidates: list[dict[str, Any]]


class ImportTemplatePayload(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    account_id: int
    config: ImportTemplateConfig

    @field_validator("name")
    @classmethod
    def non_blank_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Template name must not be blank.")
        return value.strip()


class ImportTemplateResponse(BaseModel):
    id: int
    name: str
    account_id: int | None
    config: ImportTemplateConfig
    created_at: str
    updated_at: str


class AccountPayload(BaseModel):
    name: str = Field(min_length=1, max_length=120)

    @field_validator("name")
    @classmethod
    def non_blank_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Account name must not be blank.")
        return value.strip()


class AccountResponse(BaseModel):
    id: int
    name: str
    institution: str | None
    account_type: str | None
    created_at: str
    transaction_count: int


class AccountDeleteWarning(BaseModel):
    id: int
    transaction_count: int
    requires_confirmation: bool


class LabelResponse(BaseModel):
    id: int
    slug: str
    name: str
    account_id: int | None
    account_name: str | None = None
    is_controllable: bool
    is_system: bool


class LabelPayload(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    account_id: int | None = None
    is_controllable: bool = True

    @field_validator("name")
    @classmethod
    def non_blank_name(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Label name must not be blank.")
        return value.strip()


class LabelRulePayload(BaseModel):
    label_id: int
    match_field: Literal["description"] = "description"
    match_type: Literal["contains", "regex"] = "contains"
    pattern: str = Field(min_length=1)

    @field_validator("pattern")
    @classmethod
    def non_blank_pattern(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Match pattern must not be blank.")
        return value.strip()

    @model_validator(mode="after")
    def validate_regex(self):
        if self.match_type == "regex":
            try:
                re.compile(self.pattern)
            except re.error as error:
                raise ValueError(f"Invalid regex: {error}") from error
        return self


class LabelRuleResponse(BaseModel):
    id: int
    label_id: int
    label_slug: str
    label_name: str
    label_account_id: int | None
    label_is_controllable: bool
    account_id: int | None
    account_name: str | None = None
    match_field: str
    match_type: str
    pattern: str
    created_at: str
    applied_count: int | None = None


class LabelRuleMatchPreviewRow(BaseModel):
    id: int
    transaction_date: str
    account_name: str
    description: str
    merchant: str | None
    label_name: str | None
    amount: str
    direction: str


class LabelRuleMatchPreviewResponse(BaseModel):
    total_count: int
    returned_count: int
    rows: list[LabelRuleMatchPreviewRow]


class DashboardSpendingByLabelItem(BaseModel):
    label_slug: str
    label_name: str
    amount: str


class DashboardSpendingByLabelResponse(BaseModel):
    month: str
    labels: list[DashboardSpendingByLabelItem]


class DashboardTransactionAccount(BaseModel):
    id: int
    name: str


class DashboardTransactionLabel(BaseModel):
    id: int | None
    slug: str
    name: str
    is_controllable: bool


class DashboardTransactionRow(BaseModel):
    id: int
    transaction_date: str
    account: DashboardTransactionAccount
    description: str
    merchant: str | None
    label: DashboardTransactionLabel
    direction: str
    amount: str
    source_type: str | None
    source_category: str | None
    check_number: str | None


class DashboardTransactionListResponse(BaseModel):
    month: str
    transactions: list[DashboardTransactionRow]


def serialize_template(template: ImportTemplate) -> ImportTemplateResponse:
    if template.id is None:
        raise HTTPException(status_code=500, detail="Saved template is missing an id.")
    return ImportTemplateResponse(
        id=template.id,
        name=template.name,
        account_id=template.account_id,
        config=ImportTemplateConfig.model_validate(template.config),
        created_at=template.created_at.isoformat(),
        updated_at=template.updated_at.isoformat(),
    )


def account_transaction_count(session: Session, account_id: int) -> int:
    return session.exec(select(func.count()).select_from(Transaction).where(Transaction.account_id == account_id)).one()


def serialize_account(account: Account, transaction_count: int) -> AccountResponse:
    if account.id is None:
        raise HTTPException(status_code=500, detail="Saved account is missing an id.")
    return AccountResponse(
        id=account.id,
        name=account.name,
        institution=account.institution,
        account_type=account.account_type,
        created_at=account.created_at.isoformat(),
        transaction_count=transaction_count,
    )


def require_unique_account_name(session: Session, name: str, account_id: int | None = None) -> None:
    existing = session.exec(select(Account).where(Account.name == name)).first()
    if existing is not None and existing.id != account_id:
        raise HTTPException(status_code=409, detail="Account name already exists.")


def label_slug(name: str, account_id: int | None, is_controllable: bool) -> str:
    base_slug = re.sub(r"[^a-z0-9]+", "-", name.strip().casefold()).strip("-") or "label"
    control_slug = "controllable" if is_controllable else "non-controllable"
    scoped_slug = f"{base_slug}-{account_id}" if account_id is not None else base_slug
    return f"{scoped_slug}-{control_slug}"


def serialize_label(label: Label, account: Account | None = None) -> LabelResponse:
    if label.id is None:
        raise HTTPException(status_code=500, detail="Saved label is missing an id.")
    return LabelResponse(
        id=label.id,
        slug=label.slug,
        name=label.name,
        account_id=label.account_id,
        account_name=account.name if account is not None else None,
        is_controllable=label.is_controllable,
        is_system=label.is_system,
    )


def serialize_label_rule(
    rule: TransactionLabelRule,
    label: Label,
    account: Account | None = None,
    applied_count: int | None = None,
) -> LabelRuleResponse:
    if rule.id is None:
        raise HTTPException(status_code=500, detail="Saved label rule is missing an id.")
    return LabelRuleResponse(
        id=rule.id,
        label_id=rule.label_id,
        label_slug=label.slug,
        label_name=label.name,
        label_account_id=label.account_id,
        label_is_controllable=label.is_controllable,
        account_id=rule.account_id,
        account_name=account.name if account is not None else None,
        match_field=rule.match_field,
        match_type=rule.match_type,
        pattern=rule.pattern,
        created_at=rule.created_at.isoformat(),
        applied_count=applied_count,
    )


def serialize_dashboard_amount(value: Any) -> str:
    amount = value if isinstance(value, Decimal) else Decimal(str(value))
    return serialize_decimal(normalize_decimal(amount)) or "0.00"


def serialize_dashboard_transaction(
    transaction: Transaction,
    account: Account,
    label: Label | None,
    uncategorized: Label,
) -> DashboardTransactionRow:
    if transaction.id is None or account.id is None:
        raise HTTPException(status_code=500, detail="Dashboard transaction row is missing required ids.")
    display_label = label or uncategorized
    return DashboardTransactionRow(
        id=transaction.id,
        transaction_date=transaction.transaction_date.isoformat(),
        account=DashboardTransactionAccount(id=account.id, name=account.name),
        description=transaction.description,
        merchant=transaction.merchant,
        label=DashboardTransactionLabel(
            id=label.id if label is not None else None,
            slug=display_label.slug,
            name=display_label.name,
            is_controllable=display_label.is_controllable,
        ),
        direction=transaction.direction,
        amount=serialize_dashboard_amount(transaction.amount),
        source_type=transaction.source_type,
        source_category=transaction.source_category,
        check_number=transaction.check_number,
    )


def validate_template_account(session: Session, account_id: int | None) -> None:
    if account_id is None or session.get(Account, account_id) is None:
        raise HTTPException(status_code=404, detail="Account not found.")


async def read_csv_frame(file: UploadFile) -> pl.DataFrame:
    contents = await file.read(MAX_PREVIEW_UPLOAD_BYTES + 1)
    if not contents:
        raise HTTPException(status_code=400, detail="Upload a non-empty CSV file.")
    if len(contents) > MAX_PREVIEW_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="CSV preview uploads must be 10 MB or smaller.")

    try:
        frame = pl.read_csv(BytesIO(contents), infer_schema_length=0)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not parse CSV file for preview.") from exc

    if not frame.columns:
        raise HTTPException(status_code=400, detail="CSV file must include headers.")
    return frame


def parse_template_config(config: str) -> ImportTemplateConfig:
    try:
        return ImportTemplateConfig.model_validate(json.loads(config))
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=422, detail="Template config must be valid JSON.") from exc
    except ValidationError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


def source_value(row: dict[str, Any], column: str | None) -> Any:
    if column is None:
        return None
    if column not in row:
        raise HTTPException(status_code=400, detail=f"Source column not found: {column}")
    return row[column]


def parse_decimal_value(value: Any) -> Decimal | None:
    if value is None:
        return None
    if isinstance(value, str):
        cleaned = value.strip()
        if not cleaned or cleaned in {"-", "--", "—", "–"}:
            return None
        is_parenthesized_negative = cleaned.startswith("(") and cleaned.endswith(")")
        cleaned = cleaned.removeprefix("(").removesuffix(")")
        cleaned = cleaned.replace("$", "").replace(",", "")
        if is_parenthesized_negative:
            cleaned = f"-{cleaned}"
    else:
        cleaned = str(value)

    try:
        parsed_value = Decimal(cleaned)
    except InvalidOperation as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse numeric value: {value}") from exc
    if not parsed_value.is_finite():
        raise HTTPException(status_code=400, detail=f"Could not parse numeric value: {value}")
    return parsed_value


def serialize_decimal(value: Decimal | None) -> str | None:
    if value is None:
        return None
    return str(value)


def normalize_decimal(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


def parse_date_value(value: Any) -> str | None:
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    if isinstance(value, date):
        return value.isoformat()

    raw_value = str(value).strip()
    for date_format in ("%Y-%m-%d", "%m/%d/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(raw_value, date_format).date().isoformat()
        except ValueError:
            continue
    raise HTTPException(status_code=400, detail=f"Could not parse date value: {value}")


def is_present_amount(value: Any) -> bool:
    parsed_value = parse_decimal_value(value)
    return parsed_value is not None and parsed_value != 0


def apply_transform(row: dict[str, Any], mapping: TemplateFieldMapping) -> Any:
    if mapping.transform == "copy_column":
        return source_value(row, mapping.source_column)
    if mapping.transform == "parse_date":
        return parse_date_value(source_value(row, mapping.source_column))
    if mapping.transform == "parse_numeric":
        return serialize_decimal(parse_decimal_value(source_value(row, mapping.source_column)))
    if mapping.transform == "absolute_numeric":
        parsed_value = parse_decimal_value(source_value(row, mapping.source_column))
        return serialize_decimal(abs(parsed_value)) if parsed_value is not None else None
    if mapping.transform == "split_amount":
        credit_value = parse_decimal_value(source_value(row, mapping.credit_column))
        if credit_value is not None:
            return serialize_decimal(abs(credit_value))
        debit_value = parse_decimal_value(source_value(row, mapping.debit_column))
        if debit_value is not None:
            return serialize_decimal(abs(debit_value))
        return None
    if mapping.transform == "signed_amount_direction":
        parsed_value = parse_decimal_value(source_value(row, mapping.source_column))
        if parsed_value is None or parsed_value == 0:
            return None
        return mapping.positive_direction if parsed_value > 0 else mapping.negative_direction
    if mapping.transform == "split_amount_direction":
        if parse_decimal_value(source_value(row, mapping.credit_column)) is not None:
            return "credit"
        if parse_decimal_value(source_value(row, mapping.debit_column)) is not None:
            return "debit"
        return None
    if mapping.transform == "value_lookup":
        lookup_value = source_value(row, mapping.source_column)
        lookup_key = "" if lookup_value is None else str(lookup_value)
        if mapping.rules is None or lookup_key not in mapping.rules:
            raise HTTPException(status_code=400, detail=f"No value_lookup rule for value: {lookup_key}")
        return mapping.rules[lookup_key]
    raise HTTPException(status_code=400, detail=f"Unsupported transform: {mapping.transform}")


def transform_rows(frame: pl.DataFrame, config: ImportTemplateConfig, limit: int = 5) -> list[dict[str, Any]]:
    transformed_rows: list[dict[str, Any]] = []
    for row in frame.head(limit).to_dicts():
        transformed_rows.append(transform_raw_row(row, config))
    return transformed_rows


def transform_raw_row(row: dict[str, Any], config: ImportTemplateConfig) -> dict[str, Any]:
    return {target_field: apply_transform(row, mapping) for target_field, mapping in config.mappings.items()}


def normalize_description(description: str) -> str:
    return " ".join(description.casefold().split())


def duplicate_fingerprint(
    account_id: int,
    transaction_date: date,
    normalized_description_value: str,
    amount: Decimal,
    direction: str,
) -> str:
    source = "|".join(
        [
            str(account_id),
            transaction_date.isoformat(),
            normalized_description_value,
            str(normalize_decimal(amount)),
            direction,
        ]
    )
    return hashlib.sha256(source.encode("utf-8")).hexdigest()


def require_string_field(row: dict[str, Any], field_name: str, row_number: int) -> str:
    value = row.get(field_name)
    if value is None or not str(value).strip():
        raise HTTPException(status_code=400, detail=f"Row {row_number} missing required field: {field_name}")
    return str(value).strip()


def optional_string_field(row: dict[str, Any], field_name: str) -> str | None:
    value = row.get(field_name)
    if value is None or not str(value).strip():
        return None
    return str(value).strip()


def build_transaction(upload: StoredUploadFile, raw_row: RawImportRow, transformed_row: dict[str, Any]) -> Transaction:
    if upload.id is None or raw_row.id is None or upload.account_id is None:
        raise HTTPException(status_code=500, detail="Import source context is incomplete.")

    row_number = raw_row.row_number
    transaction_date_text = require_string_field(transformed_row, "date", row_number)
    try:
        transaction_date = date.fromisoformat(transaction_date_text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"Row {row_number} has invalid date: {transaction_date_text}") from exc

    description = require_string_field(transformed_row, "description", row_number)
    amount = parse_decimal_value(require_string_field(transformed_row, "amount", row_number))
    if amount is None:
        raise HTTPException(status_code=400, detail=f"Row {row_number} missing required field: amount")
    amount = normalize_decimal(abs(amount))

    direction = require_string_field(transformed_row, "direction", row_number)
    if direction not in {"debit", "credit"}:
        raise HTTPException(status_code=400, detail=f"Row {row_number} has invalid direction: {direction}")

    balance = parse_decimal_value(transformed_row.get("balance"))
    normalized_description_value = normalize_description(description)
    fingerprint = duplicate_fingerprint(
        upload.account_id,
        transaction_date,
        normalized_description_value,
        amount,
        direction,
    )
    label_id = transformed_row.get("label_id")

    return Transaction(
        account_id=upload.account_id,
        upload_file_id=upload.id,
        raw_import_row_id=raw_row.id,
        label_id=int(label_id) if label_id is not None else None,
        transaction_date=transaction_date,
        transaction_month=transaction_date.isoformat()[:7],
        description=description,
        normalized_description=normalized_description_value,
        merchant=optional_string_field(transformed_row, "merchant"),
        amount=amount,
        direction=direction,
        source_type=optional_string_field(transformed_row, "source_type"),
        source_category=optional_string_field(transformed_row, "source_category"),
        check_number=optional_string_field(transformed_row, "check_number"),
        balance=normalize_decimal(balance) if balance is not None else None,
        duplicate_fingerprint=fingerprint,
    )


def find_duplicate_candidates(session: Session, transactions: list[Transaction]) -> list[dict[str, Any]]:
    candidates: list[dict[str, Any]] = []
    for index, transaction in enumerate(transactions):
        existing = session.exec(
            select(Transaction).where(
                Transaction.account_id == transaction.account_id,
                Transaction.transaction_date == transaction.transaction_date,
                Transaction.normalized_description == transaction.normalized_description,
                Transaction.amount == transaction.amount,
                Transaction.direction == transaction.direction,
            )
        ).first()
        if existing is None:
            continue
        candidates.append(
            {
                "row_number": index + 1,
                "existing_transaction_id": existing.id,
                "date": transaction.transaction_date.isoformat(),
                "description": transaction.description,
                "amount": serialize_decimal(transaction.amount),
                "direction": transaction.direction,
            }
        )
    return candidates


def validate_label_ids(session: Session, transactions: list[Transaction]) -> None:
    label_ids = {transaction.label_id for transaction in transactions if transaction.label_id is not None}
    for label_id in label_ids:
        if session.get(Label, label_id) is None:
            raise HTTPException(status_code=404, detail=f"Label not found: {label_id}")


def get_uncategorized_label(session: Session) -> Label:
    label = session.exec(select(Label).where(Label.slug == "uncategorized")).first()
    if label is None or label.id is None:
        raise HTTPException(status_code=500, detail="Uncategorized label is not seeded.")
    return label


def label_rule_matches(rule: TransactionLabelRule, transaction: Transaction) -> bool:
    if rule.account_id is not None and transaction.account_id != rule.account_id:
        return False
    source_value = transaction.merchant if rule.match_field == "merchant" else transaction.description
    if source_value is None:
        return False
    if rule.match_type == "regex":
        return re.search(rule.pattern, source_value, flags=re.IGNORECASE) is not None
    return rule.pattern.casefold() in source_value.casefold()


def apply_label_rules_to_transactions(session: Session, transactions: list[Transaction]) -> None:
    rules = session.exec(select(TransactionLabelRule).order_by(col(TransactionLabelRule.created_at), col(TransactionLabelRule.id))).all()
    uncategorized = get_uncategorized_label(session)
    for transaction in transactions:
        if transaction.label_id is not None:
            continue
        matching_rule = next((rule for rule in rules if label_rule_matches(rule, transaction)), None)
        transaction.label_id = matching_rule.label_id if matching_rule is not None else uncategorized.id


def apply_label_rule_to_existing_transactions(session: Session, rule: TransactionLabelRule) -> int:
    uncategorized = get_uncategorized_label(session)
    transactions = session.exec(select(Transaction)).all()
    applied_count = 0
    for transaction in transactions:
        is_unlabeled = transaction.label_id is None or transaction.label_id == uncategorized.id
        if is_unlabeled and label_rule_matches(rule, transaction):
            transaction.label_id = rule.label_id
            session.add(transaction)
            applied_count += 1
    return applied_count


def raw_rows_to_transactions(upload: StoredUploadFile, raw_rows: list[RawImportRow], config: ImportTemplateConfig) -> list[Transaction]:
    return [build_transaction(upload, raw_row, transform_raw_row(raw_row.raw_data, config)) for raw_row in raw_rows]


def transformed_rows_to_transactions(
    upload: StoredUploadFile,
    raw_rows: list[RawImportRow],
    transformed_rows: list[dict[str, Any]],
) -> list[Transaction]:
    return [
        build_transaction(upload, raw_row, transformed_row)
        for raw_row, transformed_row in zip(raw_rows, transformed_rows, strict=True)
    ]


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield


app = FastAPI(title="Personal Finance API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

if (STATIC_DIR / "assets").exists():
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")


@app.get("/health")
def health() -> dict[str, str]:
    check_database()
    return {"status": "ok", "database": "ok"}


@app.get("/accounts")
def list_accounts() -> list[AccountResponse]:
    with Session(engine) as session:
        rows = session.exec(
            select(Account, func.count(col(Transaction.id)))
            .join(Transaction, col(Account.id) == Transaction.account_id, isouter=True)
            .group_by(col(Account.id))
            .order_by(Account.name)
        ).all()
    return [serialize_account(account, transaction_count) for account, transaction_count in rows]


@app.post("/accounts", status_code=201)
def create_account(payload: AccountPayload) -> AccountResponse:
    with Session(engine) as session:
        require_unique_account_name(session, payload.name)
        account = Account(name=payload.name)
        session.add(account)
        session.commit()
        session.refresh(account)
        return serialize_account(account, 0)


@app.put("/accounts/{account_id}")
def rename_account(account_id: int, payload: AccountPayload) -> AccountResponse:
    with Session(engine) as session:
        account = session.get(Account, account_id)
        if account is None:
            raise HTTPException(status_code=404, detail="Account not found.")
        require_unique_account_name(session, payload.name, account_id)
        account.name = payload.name
        session.add(account)
        session.commit()
        session.refresh(account)
        return serialize_account(account, account_transaction_count(session, account_id))


@app.delete("/accounts/{account_id}", response_model=None)
def delete_account(account_id: int, confirmed: bool = False) -> AccountDeleteWarning | Response:
    with Session(engine) as session:
        account = session.get(Account, account_id)
        if account is None:
            raise HTTPException(status_code=404, detail="Account not found.")
        transaction_count = account_transaction_count(session, account_id)
        if transaction_count > 0 and not confirmed:
            return JSONResponse(
                status_code=409,
                content={"id": account_id, "transaction_count": transaction_count, "requires_confirmation": True},
            )

        upload_ids = [
            upload_id
            for upload_id in session.exec(select(StoredUploadFile.id).where(StoredUploadFile.account_id == account_id)).all()
            if upload_id is not None
        ]
        for transaction in session.exec(select(Transaction).where(Transaction.account_id == account_id)).all():
            session.delete(transaction)
        for template in session.exec(select(ImportTemplate).where(ImportTemplate.account_id == account_id)).all():
            session.delete(template)
        for upload_id in upload_ids:
            for raw_row in session.exec(select(RawImportRow).where(RawImportRow.upload_file_id == upload_id)).all():
                session.delete(raw_row)
        for upload in session.exec(select(StoredUploadFile).where(StoredUploadFile.account_id == account_id)).all():
            session.delete(upload)
        session.commit()
        session.delete(account)
        session.commit()
    return Response(status_code=204)


@app.post("/imports/preview")
async def preview_import(file: UploadFile) -> CsvPreviewResponse:
    frame = await read_csv_frame(file)
    headers = frame.columns
    preview_rows = frame.head(5).to_dicts()
    return CsvPreviewResponse(headers=headers, rows=preview_rows, source_columns=headers)


@app.post("/imports/unique-values")
async def list_unique_source_values(file: UploadFile, source_column: str = Form(...)) -> UniqueValuesResponse:
    frame = await read_csv_frame(file)
    if source_column not in frame.columns:
        raise HTTPException(status_code=400, detail=f"Source column not found: {source_column}")

    values = sorted({str(value) for value in frame[source_column].drop_nulls().to_list() if str(value).strip()})
    return UniqueValuesResponse(source_column=source_column, values=values)


@app.post("/imports/transformed-preview")
async def preview_transformed_import(
    file: UploadFile,
    template_config: str = Form(...),
) -> TransformedPreviewResponse:
    frame = await read_csv_frame(file)
    config = parse_template_config(template_config)
    return TransformedPreviewResponse(rows=transform_rows(frame, config))


@app.post("/imports/prepare", status_code=201)
async def prepare_import(
    file: UploadFile,
    account_id: int = Form(...),
    template_config: str = Form(...),
) -> ImportPrepareResponse:
    frame = await read_csv_frame(file)
    config = parse_template_config(template_config)
    raw_rows = frame.to_dicts()
    transformed_rows = [transform_raw_row(row, config) for row in raw_rows]

    with Session(engine) as session:
        if session.get(Account, account_id) is None:
            raise HTTPException(status_code=404, detail="Account not found.")

        upload = StoredUploadFile(
            account_id=account_id,
            original_filename=file.filename or "upload.csv",
            content_type=file.content_type,
            row_count=len(raw_rows),
            status="prepared",
        )
        session.add(upload)
        session.commit()
        session.refresh(upload)
        if upload.id is None:
            raise HTTPException(status_code=500, detail="Saved upload is missing an id.")

        stored_rows = [RawImportRow(upload_file_id=upload.id, row_number=index, raw_data=row) for index, row in enumerate(raw_rows, 1)]
        session.add_all(stored_rows)
        session.commit()
        for stored_row in stored_rows:
            session.refresh(stored_row)

        transactions = transformed_rows_to_transactions(upload, stored_rows, transformed_rows)
        duplicate_candidates = find_duplicate_candidates(session, transactions)

    return ImportPrepareResponse(
        upload_file_id=upload.id,
        row_count=len(raw_rows),
        transformed_preview=transformed_rows[:5],
        duplicate_candidates=duplicate_candidates,
    )


@app.post("/imports/confirm")
def confirm_import(payload: ConfirmImportPayload) -> ConfirmImportResponse:
    with Session(engine) as session:
        upload = session.get(StoredUploadFile, payload.upload_file_id)
        if upload is None:
            raise HTTPException(status_code=404, detail="Upload file not found.")

        raw_rows = session.exec(
            select(RawImportRow)
            .where(RawImportRow.upload_file_id == payload.upload_file_id)
            .order_by(col(RawImportRow.row_number))
        ).all()
        transactions = raw_rows_to_transactions(upload, list(raw_rows), payload.template_config)
        validate_label_ids(session, transactions)
        apply_label_rules_to_transactions(session, transactions)
        duplicate_candidates = find_duplicate_candidates(session, transactions)
        if duplicate_candidates and not payload.allow_duplicates:
            upload.status = "duplicate_warning"
            session.add(upload)
            session.commit()
            return ConfirmImportResponse(
                upload_file_id=payload.upload_file_id,
                inserted_count=0,
                duplicate_candidates=duplicate_candidates,
            )

        session.add_all(transactions)
        upload.status = "imported"
        session.add(upload)
        session.commit()

    return ConfirmImportResponse(
        upload_file_id=payload.upload_file_id,
        inserted_count=len(transactions),
        duplicate_candidates=duplicate_candidates,
    )


@app.get("/labels")
def list_labels() -> list[LabelResponse]:
    with Session(engine) as session:
        labels = session.exec(select(Label).order_by(Label.name)).all()
        responses = [serialize_label(label, session.get(Account, label.account_id) if label.account_id is not None else None) for label in labels]
    return responses


@app.post("/labels", status_code=201)
def create_label(payload: LabelPayload) -> LabelResponse:
    with Session(engine) as session:
        account = session.get(Account, payload.account_id) if payload.account_id is not None else None
        if payload.account_id is not None and account is None:
            raise HTTPException(status_code=404, detail="Account not found.")

        slug = label_slug(payload.name, payload.account_id, payload.is_controllable)
        existing_label = session.exec(
            select(Label).where(
                Label.name == payload.name,
                Label.account_id == payload.account_id,
                Label.is_controllable == payload.is_controllable,
            )
        ).first()
        if existing_label is not None:
            raise HTTPException(status_code=409, detail="Label already exists for that scope and control type.")

        label = Label(
            slug=slug,
            name=payload.name,
            account_id=payload.account_id,
            is_controllable=payload.is_controllable,
            is_system=False,
        )
        session.add(label)
        session.commit()
        session.refresh(label)
        return serialize_label(label, account)


@app.put("/labels/{label_id}")
def update_label(label_id: int, payload: LabelPayload) -> LabelResponse:
    with Session(engine) as session:
        label = session.get(Label, label_id)
        if label is None:
            raise HTTPException(status_code=404, detail="Label not found.")
        if label.is_system:
            raise HTTPException(status_code=400, detail="System labels cannot be edited.")

        account = session.get(Account, payload.account_id) if payload.account_id is not None else None
        if payload.account_id is not None and account is None:
            raise HTTPException(status_code=404, detail="Account not found.")

        existing_label = session.exec(
            select(Label).where(
                Label.name == payload.name,
                Label.account_id == payload.account_id,
                Label.is_controllable == payload.is_controllable,
            )
        ).first()
        if existing_label is not None and existing_label.id != label.id:
            raise HTTPException(status_code=409, detail="Label already exists for that scope and control type.")

        label.name = payload.name
        label.account_id = payload.account_id
        label.is_controllable = payload.is_controllable
        label.slug = label_slug(payload.name, payload.account_id, payload.is_controllable)
        session.add(label)
        rules = session.exec(select(TransactionLabelRule).where(TransactionLabelRule.label_id == label_id)).all()
        for rule in rules:
            rule.account_id = payload.account_id
            session.add(rule)
        session.commit()
        session.refresh(label)
        return serialize_label(label, account)


@app.delete("/labels/{label_id}", status_code=204)
def delete_label(label_id: int) -> Response:
    with Session(engine) as session:
        label = session.get(Label, label_id)
        if label is None:
            raise HTTPException(status_code=404, detail="Label not found.")
        if label.is_system:
            raise HTTPException(status_code=400, detail="System labels cannot be deleted.")

        transactions = session.exec(select(Transaction).where(Transaction.label_id == label_id)).all()
        for transaction in transactions:
            transaction.label_id = None
            session.add(transaction)
        rules = session.exec(select(TransactionLabelRule).where(TransactionLabelRule.label_id == label_id)).all()
        for rule in rules:
            session.delete(rule)
        session.commit()
        session.delete(label)
        session.commit()
    return Response(status_code=204)


@app.get("/dashboard/spending-by-label")
def get_dashboard_spending_by_label(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    account_ids: list[int] = Query(default=[]),
) -> DashboardSpendingByLabelResponse:
    with Session(engine) as session:
        uncategorized = get_uncategorized_label(session)
        label_slug = func.coalesce(Label.slug, uncategorized.slug)
        label_name = func.coalesce(Label.name, uncategorized.name)
        statement = (
            select(label_slug, label_name, func.sum(Transaction.amount))
            .join(Label, col(Transaction.label_id) == Label.id, isouter=True)
            .where(Transaction.transaction_month == month, Transaction.direction == "debit")
            .group_by(label_slug, label_name)
            .order_by(label_name)
        )
        if account_ids:
            statement = statement.where(col(Transaction.account_id).in_(account_ids))
        rows = session.exec(statement).all()

    labels = [
        DashboardSpendingByLabelItem(
            label_slug=slug,
            label_name=name,
            amount=serialize_dashboard_amount(total),
        )
        for slug, name, total in rows
        if total is not None
    ]
    return DashboardSpendingByLabelResponse(month=month, labels=labels)


@app.get("/dashboard/transactions")
def get_dashboard_transactions(
    month: str = Query(..., pattern=r"^\d{4}-\d{2}$"),
    account_ids: list[int] = Query(default=[]),
    label_ids: list[int] = Query(default=[]),
    label_slugs: list[str] = Query(default=[]),
) -> DashboardTransactionListResponse:
    with Session(engine) as session:
        uncategorized = get_uncategorized_label(session)
        statement = (
            select(Transaction, Account, Label)
            .join(Account, col(Transaction.account_id) == Account.id)
            .join(Label, col(Transaction.label_id) == Label.id, isouter=True)
            .where(Transaction.transaction_month == month)
            .order_by(col(Transaction.transaction_date), col(Transaction.id))
        )
        if account_ids:
            statement = statement.where(col(Transaction.account_id).in_(account_ids))
        if label_ids:
            label_filter_clauses = [col(Transaction.label_id).in_(label_ids)]
            if uncategorized.id in label_ids:
                label_filter_clauses.append(col(Transaction.label_id).is_(None))
            statement = statement.where(or_(*label_filter_clauses))
        if label_slugs:
            label_slug_filter_clauses = [col(Label.slug).in_(label_slugs)]
            if uncategorized.slug in label_slugs:
                label_slug_filter_clauses.append(col(Transaction.label_id).is_(None))
            statement = statement.where(or_(*label_slug_filter_clauses))
        rows = session.exec(statement).all()

    return DashboardTransactionListResponse(
        month=month,
        transactions=[
            serialize_dashboard_transaction(transaction, account, label, uncategorized)
            for transaction, account, label in rows
        ],
    )


@app.get("/transaction-label-rules")
def list_transaction_label_rules() -> list[LabelRuleResponse]:
    with Session(engine) as session:
        rules = session.exec(select(TransactionLabelRule).order_by(col(TransactionLabelRule.created_at), col(TransactionLabelRule.id))).all()
        responses: list[LabelRuleResponse] = []
        for rule in rules:
            label = session.get(Label, rule.label_id)
            if label is None:
                raise HTTPException(status_code=500, detail="Label rule references a missing label.")
            account = session.get(Account, rule.account_id) if rule.account_id is not None else None
            responses.append(serialize_label_rule(rule, label, account))
    return responses


@app.get("/transaction-label-rules/matches")
def preview_transaction_label_rule_matches(
    match_field: Literal["description"] = "description",
    pattern: str = Query(min_length=1),
    match_type: Literal["contains", "regex"] = "contains",
    label_id: int | None = None,
    limit: int = Query(default=25, ge=1, le=100),
) -> LabelRuleMatchPreviewResponse:
    pattern = pattern.strip()
    if not pattern:
        raise HTTPException(status_code=422, detail="Pattern must not be blank.")
    if match_type == "regex":
        try:
            re.compile(pattern)
        except re.error as error:
            raise HTTPException(status_code=422, detail=f"Invalid regex: {error}") from error

    account_id: int | None = None
    with Session(engine) as session:
        if label_id is not None:
            label = session.get(Label, label_id)
            if label is None:
                raise HTTPException(status_code=404, detail="Label not found.")
            account_id = label.account_id

    preview_rule = TransactionLabelRule(label_id=0, account_id=account_id, match_field=match_field, match_type=match_type, pattern=pattern)
    statement = select(Transaction, Account, Label).join(Account, col(Transaction.account_id) == Account.id).join(Label, col(Transaction.label_id) == Label.id, isouter=True)
    if account_id is not None:
        statement = statement.where(Transaction.account_id == account_id)
    statement = statement.order_by(col(Transaction.transaction_date).desc(), col(Transaction.id).desc())

    rows: list[LabelRuleMatchPreviewRow] = []
    total_count = 0
    with Session(engine) as session:
        for transaction, account, label in session.exec(statement).all():
            if not label_rule_matches(preview_rule, transaction):
                continue
            total_count += 1
            if len(rows) < limit:
                rows.append(
                    LabelRuleMatchPreviewRow(
                        id=transaction.id or 0,
                        transaction_date=transaction.transaction_date.isoformat(),
                        account_name=account.name,
                        description=transaction.description,
                        merchant=transaction.merchant,
                        label_name=label.name if label is not None else None,
                        amount=serialize_dashboard_amount(transaction.amount),
                        direction=transaction.direction,
                    )
                )
    return LabelRuleMatchPreviewResponse(total_count=total_count, returned_count=len(rows), rows=rows)


@app.post("/transaction-label-rules", status_code=201)
def create_transaction_label_rule(payload: LabelRulePayload) -> LabelRuleResponse:
    with Session(engine) as session:
        label = session.get(Label, payload.label_id)
        if label is None:
            raise HTTPException(status_code=404, detail="Label not found.")

        rule = TransactionLabelRule(
            label_id=payload.label_id,
            account_id=label.account_id,
            match_field=payload.match_field,
            match_type=payload.match_type,
            pattern=payload.pattern,
        )
        session.add(rule)
        session.commit()
        session.refresh(rule)
        applied_count = apply_label_rule_to_existing_transactions(session, rule)
        session.commit()
        session.refresh(rule)
        session.refresh(label)
        account = session.get(Account, rule.account_id) if rule.account_id is not None else None
        return serialize_label_rule(rule, label, account, applied_count)


@app.post("/import-templates", status_code=201)
def create_import_template(payload: ImportTemplatePayload) -> ImportTemplateResponse:
    template = ImportTemplate(
        name=payload.name,
        account_id=payload.account_id,
        config=payload.config.model_dump(mode="json"),
    )
    with Session(engine) as session:
        validate_template_account(session, payload.account_id)
        session.add(template)
        session.commit()
        session.refresh(template)

    return serialize_template(template)


@app.get("/import-templates")
def list_import_templates(account_id: int | None = None) -> list[ImportTemplateResponse]:
    statement = select(ImportTemplate).order_by(ImportTemplate.name)
    if account_id is not None:
        statement = statement.where(ImportTemplate.account_id == account_id)

    with Session(engine) as session:
        templates = session.exec(statement).all()

    return [serialize_template(template) for template in templates]


@app.get("/import-templates/{template_id}")
def get_import_template(template_id: int) -> ImportTemplateResponse:
    with Session(engine) as session:
        template = session.get(ImportTemplate, template_id)

    if template is None:
        raise HTTPException(status_code=404, detail="Import template not found.")
    return serialize_template(template)


@app.put("/import-templates/{template_id}")
def update_import_template(template_id: int, payload: ImportTemplatePayload) -> ImportTemplateResponse:
    with Session(engine) as session:
        template = session.get(ImportTemplate, template_id)
        if template is None:
            raise HTTPException(status_code=404, detail="Import template not found.")
        validate_template_account(session, payload.account_id)

        template.name = payload.name
        template.account_id = payload.account_id
        template.config = payload.config.model_dump(mode="json")
        template.updated_at = utc_now()
        session.add(template)
        session.commit()
        session.refresh(template)

    return serialize_template(template)


@app.delete("/import-templates/{template_id}", status_code=204)
def delete_import_template(template_id: int) -> Response:
    with Session(engine) as session:
        template = session.get(ImportTemplate, template_id)
        if template is None:
            raise HTTPException(status_code=404, detail="Import template not found.")

        session.delete(template)
        session.commit()

    return Response(status_code=204)


@app.get("/{path:path}", include_in_schema=False)
def serve_frontend(path: str) -> FileResponse:
    requested_path = (STATIC_DIR / path).resolve()
    if path and requested_path.is_file() and requested_path.is_relative_to(STATIC_DIR.resolve()):
        return FileResponse(requested_path)

    index_path = STATIC_DIR / "index.html"
    if index_path.exists():
        return FileResponse(index_path)

    raise HTTPException(status_code=404, detail="Frontend static files not found.")
