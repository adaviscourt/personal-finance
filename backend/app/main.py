from contextlib import asynccontextmanager
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from io import BytesIO
import json
from typing import Any, Literal

import polars as pl
from fastapi import FastAPI, Form, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError, field_validator, model_validator
from sqlalchemy import or_
from sqlmodel import Session, col, select

from app.database import Account, ImportTemplate, check_database, engine, init_db, utc_now


MAX_PREVIEW_UPLOAD_BYTES = 10 * 1024 * 1024
REQUIRED_TEMPLATE_MAPPINGS = {"date", "description", "amount", "direction"}


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
        if self.transform == "split_amount_direction":
            if not self.debit_column or not self.credit_column:
                raise ValueError("split_amount_direction requires debit_column and credit_column.")
            return self

        if not self.source_column:
            raise ValueError(f"{self.transform} requires source_column.")
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


class ImportTemplatePayload(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    account_id: int | None = None
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


def validate_template_account(session: Session, account_id: int | None) -> None:
    if account_id is not None and session.get(Account, account_id) is None:
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
        if not cleaned:
            return None
        is_parenthesized_negative = cleaned.startswith("(") and cleaned.endswith(")")
        cleaned = cleaned.removeprefix("(").removesuffix(")")
        cleaned = cleaned.replace("$", "").replace(",", "")
        if is_parenthesized_negative:
            cleaned = f"-{cleaned}"
    else:
        cleaned = str(value)

    try:
        return Decimal(cleaned)
    except InvalidOperation as exc:
        raise HTTPException(status_code=400, detail=f"Could not parse numeric value: {value}") from exc


def serialize_decimal(value: Decimal | None) -> str | None:
    if value is None:
        return None
    return str(value)


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
    if mapping.transform == "signed_amount_direction":
        parsed_value = parse_decimal_value(source_value(row, mapping.source_column))
        if parsed_value is None or parsed_value == 0:
            return None
        return mapping.positive_direction if parsed_value > 0 else mapping.negative_direction
    if mapping.transform == "split_amount_direction":
        if is_present_amount(source_value(row, mapping.credit_column)):
            return "credit"
        if is_present_amount(source_value(row, mapping.debit_column)):
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
        transformed_rows.append(
            {target_field: apply_transform(row, mapping) for target_field, mapping in config.mappings.items()}
        )
    return transformed_rows


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


@app.get("/health")
def health() -> dict[str, str]:
    check_database()
    return {"status": "ok", "database": "ok"}


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
        statement = statement.where(
            or_(col(ImportTemplate.account_id) == account_id, col(ImportTemplate.account_id).is_(None))
        )

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
