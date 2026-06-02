from contextlib import asynccontextmanager
from io import BytesIO
from typing import Any

import polars as pl
from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.database import check_database, init_db


MAX_PREVIEW_UPLOAD_BYTES = 10 * 1024 * 1024


class CsvPreviewResponse(BaseModel):
    headers: list[str]
    rows: list[dict[str, Any]]
    source_columns: list[str]


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
