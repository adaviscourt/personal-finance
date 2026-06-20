## Why

Recent implementation work in PRs 47-49 changed user-visible dashboard, import, labeling, transform, and deployment behavior faster than OpenSpec artifacts were updated. This change brings the specs back in sync so future verification and archive checks reflect the shipped application.

## What Changes

- Update dashboard requirements for the refined review surface: sortable transaction columns, persisted compact filters, debit/credit/net KPI cards, controllable/non-controllable activity splits, spending bars with amounts, and seven-month net activity trend chart.
- Update import requirements for the progressive account-first workflow, transformed preview gating, contextual prepare errors, and split debit/credit source column support.
- Update transaction labeling requirements for custom labels, account-scoped labels and rules, controllable metadata, contains/regex description matching, debounced match preview, grouped label display, rule editing, rule deletion, and cleanup of labels applied by changed or deleted rules.
- Update transform requirements for split debit/credit amount and direction handling, including dash placeholders and validation errors when split amount columns are ambiguous or empty.
- Add deployment requirements for a production container that serves the frontend from FastAPI, persists SQLite data under `/data`, publishes releases to GHCR, and supports Unraid installation through an XML template.
- Document test/database isolation expectations so backend test runs do not mutate the local development SQLite database.

## Capabilities

### New Capabilities

- `production-deployment`: Production Docker image, release publishing, persistent `/data` storage, FastAPI static frontend serving, and Unraid template installation behavior.

### Modified Capabilities

- `finance-dashboard`: Dashboard summary cards, sorting, persisted filters, spending visualization, and seven-month trend requirements changed.
- `transaction-import`: Import workflow sequencing, preview gating, validation feedback, and account-scoped import behavior changed.
- `transaction-labeling`: Label taxonomy, custom/scoped labels, controllability metadata, matching rule lifecycle, match preview, and rule cleanup behavior changed.
- `transaction-transforms`: Split debit/credit source column transforms and validation behavior changed.
- `import-templates`: Template mapping and account-scoped template behavior changed for split-column imports.
- `account-management`: Account selection and account-scoped behaviors changed across import, labels, templates, and dashboard filters.

## Impact

- Backend API and persistence changes in `backend/app/main.py` and `backend/app/database.py`, including label scope/control metadata, label rule update/delete endpoints, rule provenance, dashboard activity data, and static frontend serving.
- Backend tests in `backend/tests/` need to cover temp SQLite isolation, split imports, dashboard totals, label scope/control metadata, and rule lifecycle cleanup.
- Frontend changes in `frontend/src/App.tsx`, `frontend/src/App.css`, and `frontend/src/api/client.ts` cover dashboard, import, labeling, charts, filter persistence, rule editing/deletion, and production API contracts.
- Frontend tests in `frontend/src/App.test.tsx` and API tests need to cover updated workflows and UI behavior.
- Deployment files include `Dockerfile`, `.dockerignore`, `.github/workflows/build-and-publish.yaml`, `unraid/personal-finance.xml`, `image.svg`, and README installation notes.
