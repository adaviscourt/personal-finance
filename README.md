# personal-finance

![specs](https://raw.githubusercontent.com/adaviscourt/personal-finance/gh-pages/badges/number_of_specs.svg)
![requirements](https://raw.githubusercontent.com/adaviscourt/personal-finance/gh-pages/badges/number_of_requirements.svg)
![tasks](https://raw.githubusercontent.com/adaviscourt/personal-finance/gh-pages/badges/tasks_status.svg)
![changes](https://raw.githubusercontent.com/adaviscourt/personal-finance/gh-pages/badges/open_changes.svg)

Docker-runnable personal finance MVP with a Vite + React frontend, FastAPI backend, SQLite persistence, and Polars CSV processing.

## Setup

- Install Docker Desktop for the simplest full-stack run.
- Install `uv` for backend dependency/env management and Node.js if running backend or frontend outside Docker.
- Create an account in the Accounts module before your first import in a clean Docker volume.

## Docker Usage

Run the full application with persisted SQLite storage:

```bash
docker compose up --build
```

The frontend runs at `http://localhost:5173` and the backend health endpoint runs at `http://localhost:8000/health`.

SQLite data is persisted in the `finance-data` Docker volume at `/data/personal_finance.db` inside the backend container.

## Unraid Usage

The Unraid template lives at `unraid/personal-finance.xml` and uses `ghcr.io/adaviscourt/personal-finance:latest`.

- Web UI: `http://[server-ip]:8000/`
- Persistent app data: `/mnt/user/appdata/personal-finance` on Unraid mounted to `/data` in the container
- Database URL: `sqlite:////data/personal_finance.db`

Publish a new image by creating a GitHub release. Unraid upgrades can pull the new image without losing data because SQLite stays in the mapped appdata path.

Stop the stack:

```bash
docker compose down
```

Reset local Docker data:

```bash
docker compose down -v
```

## Local Development

- `make dev` starts the full Docker stack.
- `make backend` uses `uv sync` from `backend/pyproject.toml` and `backend/uv.lock`, then starts FastAPI on port `8000`.
- `make frontend` starts the Vite frontend on port `5173`.
- `make test-backend` runs backend tests.
- `make test-frontend` runs frontend tests.

## MVP Workflow

1. Start Docker with `docker compose up --build`.
2. Open `http://localhost:5173`.
3. Upload `samples/signed-amount.csv` for the full UI workflow.
4. Preview raw source rows and source columns.
5. Map required fields: `date`, `description`, `amount`, and `direction`.
6. Save or update an import template for reuse.
7. Create or select an account, then prepare the import to review transformed rows and duplicate warnings.
8. Confirm the import to create normalized transactions.
9. Add a label rule for merchant or description text, then review applied label count.
10. Select the imported transaction month in the dashboard to chart debit spending by label.

## Sample CSV Fixtures

- `samples/signed-amount.csv` covers positive credit and negative debit direction from one signed amount column and is ready for the current UI workflow.
- `samples/split-debit-credit.csv` covers separate debit and credit amount columns for split-direction validation.
- `samples/value-lookup-direction.csv` covers source value lookup direction mapping from a semantic flow column for lookup validation.
