.PHONY: dev check-uv install-backend backend frontend test-backend test-frontend docker-up docker-down

BACKEND_VENV := backend/.venv
BACKEND_PYTHON := $(BACKEND_VENV)/bin/python
BACKEND_UVICORN := $(BACKEND_VENV)/bin/uvicorn
BACKEND_PYTEST := $(BACKEND_VENV)/bin/pytest

dev:
	docker compose up --build

check-uv:
	@command -v uv >/dev/null 2>&1 || { echo "uv is required. Install it from https://docs.astral.sh/uv/getting-started/installation/"; exit 1; }

install-backend: check-uv
	uv venv --allow-existing $(BACKEND_VENV)
	uv pip install --python $(BACKEND_PYTHON) -r backend/requirements.txt

backend: install-backend
	cd backend && ../$(BACKEND_UVICORN) app.main:app --reload --host 0.0.0.0 --port 8000

frontend:
	cd frontend && npm run dev -- --host 0.0.0.0

test-backend: install-backend
	cd backend && ../$(BACKEND_PYTEST)

test-frontend:
	cd frontend && npm test -- --run

docker-up:
	docker compose up --build

docker-down:
	docker compose down
