.PHONY: dev install-backend backend frontend test-backend test-frontend docker-up docker-down

BACKEND_VENV := backend/.venv
BACKEND_PIP := $(BACKEND_VENV)/bin/pip
BACKEND_UVICORN := $(BACKEND_VENV)/bin/uvicorn
BACKEND_PYTEST := $(BACKEND_VENV)/bin/pytest

dev:
	docker compose up --build

install-backend:
	python3 -m venv $(BACKEND_VENV)
	$(BACKEND_PIP) install -r backend/requirements.txt

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
