from contextlib import asynccontextmanager
from io import BytesIO
from typing import Any, Literal

import polars as pl
from fastapi import FastAPI, HTTPException, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator, model_validator
from sqlmodel import Session, col, select

from app.database import ImportTemplate, check_database, engine, init_db, utc_now


MAX_PREVIEW_UPLOAD_BYTES = 10 * 1024 * 1024
REQUIRED_TEMPLATE_MAPPINGS = {"date", "description", "amount", "direction"}


class CsvPreviewResponse(BaseModel):
    headers: list[str]
    rows: list[dict[str, Any]]
    source_columns: list[str]


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
    contents = await file.read(MAX_PREVIEW_UPLOAD_BYTES + 1)
    if not contents:
        raise HTTPException(status_code=400, detail="Upload a non-empty CSV file.")
    if len(contents) > MAX_PREVIEW_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="CSV preview uploads must be 10 MB or smaller.")

    try:
        frame = pl.read_csv(BytesIO(contents), infer_schema_length=0)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Could not parse CSV file for preview.") from exc

    headers = frame.columns
    if not headers:
        raise HTTPException(status_code=400, detail="CSV file must include headers.")

    preview_rows = frame.head(5).to_dicts()
    return CsvPreviewResponse(headers=headers, rows=preview_rows, source_columns=headers)


@app.post("/import-templates", status_code=201)
def create_import_template(payload: ImportTemplatePayload) -> ImportTemplateResponse:
    template = ImportTemplate(
        name=payload.name,
        account_id=payload.account_id,
        config=payload.config.model_dump(mode="json"),
    )
    with Session(engine) as session:
        session.add(template)
        session.commit()
        session.refresh(template)

    return serialize_template(template)


@app.get("/import-templates")
def list_import_templates(account_id: int | None = None) -> list[ImportTemplateResponse]:
    statement = select(ImportTemplate).order_by(ImportTemplate.name)
    if account_id is not None:
        statement = statement.where(
            (ImportTemplate.account_id == account_id) | col(ImportTemplate.account_id).is_(None)
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
