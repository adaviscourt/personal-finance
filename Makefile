.PHONY: dev check-uv install-backend backend frontend test-backend test-frontend docker-up docker-down

dev:
	docker compose up --build

check-uv:
	@command -v uv >/dev/null 2>&1 || { echo "uv is required. Install it from https://docs.astral.sh/uv/getting-started/installation/"; exit 1; }

install-backend: check-uv
	uv --directory backend sync

backend: install-backend
	uv --directory backend run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend:
	cd frontend && npm run dev -- --host 0.0.0.0

test-backend: install-backend
	uv --directory backend run pytest

test-frontend:
	cd frontend && npm test -- --run

docker-up:
	docker compose up --build

docker-down:
	docker compose down
