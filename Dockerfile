FROM node:22-alpine AS frontend-build

WORKDIR /frontend

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/ ./
RUN VITE_API_BASE_URL= npm run build

FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.11.8 /uv /uvx /bin/

ENV DATABASE_URL=sqlite:////data/personal_finance.db

WORKDIR /app

COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev

COPY backend/app ./app
COPY --from=frontend-build /frontend/dist ./app/static

EXPOSE 8000

CMD [".venv/bin/uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
