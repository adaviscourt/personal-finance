# personal-finance

Docker-runnable personal finance MVP foundation with a Vite + React frontend, FastAPI backend, SQLite persistence, and Polars-ready CSV processing.

## Local Development

- `make dev` starts the full Docker stack.
- `make backend` starts the FastAPI backend locally on port `8000`.
- `make frontend` starts the Vite frontend locally on port `5173`.
- `make test-backend` runs backend tests.
- `make test-frontend` runs frontend tests.

## Docker

Run the application with persisted SQLite storage:

```bash
docker compose up --build
```

The frontend runs at `http://localhost:5173` and the backend health endpoint runs at `http://localhost:8000/health`.

SQLite data is persisted in the `finance-data` Docker volume at `/data/personal_finance.db` inside the backend container.
