.PHONY: dev backend frontend test-backend test-frontend docker-up docker-down

dev:
	docker compose up --build

backend:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend:
	cd frontend && npm run dev -- --host 0.0.0.0

test-backend:
	cd backend && pytest

test-frontend:
	cd frontend && npm test -- --run

docker-up:
	docker compose up --build

docker-down:
	docker compose down
