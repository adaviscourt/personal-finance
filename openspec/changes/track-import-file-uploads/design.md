## Context

The backend already persists import source context in `upload_files`, `raw_import_rows`, and `transactions.upload_file_id`. Preparing an import creates an upload and raw rows; confirming an import creates transactions linked to that upload. The missing pieces are user-facing upload management, upload-level deletion, and a clearer import UI structure.

The current import route renders account selection, CSV preview, template mapping, transformed preview, duplicate warnings, and confirmation on one growing page. Product direction favors a FreeTaxUSA-style guided flow: visible progress, one focused step at a time, clear back navigation, plain tables, and restrained green/blue product styling.

## Goals / Non-Goals

**Goals:**
- Show `/import` as an upload ledger first, with file name, account, imported transaction count, transformed transaction date range, status, and delete controls.
- Add backend support for listing upload summaries and deleting an upload's imported transactions in one operation.
- Move the import task into a separate progressive flow with dedicated screens for account, source CSV, mapping/template, review, and confirmation.
- Preserve existing template mapping, duplicate detection, label-rule application, and dashboard review behavior.
- Keep UI accessible, table-first, keyboard-friendly, and consistent with existing component vocabulary.

**Non-Goals:**
- Do not add multi-user permissions, remote file storage, or asynchronous import jobs.
- Do not redesign dashboard, labels, accounts, or import-template capabilities beyond what the new flow needs.
- Do not delete raw upload rows by default when removing imported transactions unless the requirement explicitly changes to remove the upload record itself.
- Do not add a modal-heavy workflow; confirmation can be inline or native browser confirmation if implementation stays minimal.

## Decisions

### Use existing upload source tables as system of record

`upload_files` remains the parent record for import attempts. `transactions.upload_file_id` is the source link used for summaries and deletion. `raw_import_rows` stays tied to the upload for audit/source context.

Alternative considered: add a new `import_batches` table. Rejected because `upload_files` already models the batch and is referenced by raw rows and transactions.

### Add summary API instead of computing upload ledger in frontend

Add `GET /imports/uploads` returning upload id, original filename, account id/name, status, prepared row count, imported transaction count, min transaction date, max transaction date, and created timestamp. Compute counts and date ranges from `transactions`, grouped by upload, so the ledger reflects confirmed imported rows rather than raw CSV rows.

Alternative considered: fetch raw uploads and transactions separately. Rejected because it spreads SQL grouping and edge-case handling into frontend code.

### Delete imported transactions by upload, preserve upload record

Add `DELETE /imports/uploads/{upload_file_id}` that deletes transactions with that `upload_file_id`, sets upload status to a deleted/removed state, and returns the deleted transaction count. Preserve `upload_files` and `raw_import_rows` so the ledger can show that a file was removed and source context remains auditable locally.

Alternative considered: cascade-delete upload, raw rows, and transactions. Rejected because it erases the record of what file was imported and makes accidental deletions harder to reason about.

### Keep prepared uploads out of primary ledger counts

Prepared or duplicate-warning uploads may appear with zero imported transactions and no date range, but the primary value of the ledger is confirmed imports. UI copy should distinguish `prepared`, `duplicate_warning`, `imported`, and `removed` statuses so zero-count rows are understandable.

Alternative considered: list only imported uploads. Rejected because an abandoned prepared upload could still exist and would be invisible to cleanup.

### Split import route into landing and flow routes

Use `/import` for the upload ledger and `/import/new` for the progressive import flow. Inside `/import/new`, track current step in component state or a route segment if implementation complexity stays low. A static step tracker should indicate active, complete, and unavailable states.

Alternative considered: keep one route and conditionally swap landing/flow views. Acceptable for implementation, but separate routes create clearer navigation and safer browser back behavior.

### Reuse existing import state and controls, reorganized by step

The first implementation should move existing account, file preview, template mapping, transformed preview, duplicate warning, and confirmation logic into focused step panels instead of rewriting import internals. Back buttons should keep prior step state intact, while changing account/file/template should clear downstream prepared/confirmed state.

Alternative considered: introduce a full state-machine library. Rejected because current flow is linear and local component state is enough.

## Risks / Trade-offs

- Deleting by upload could remove transactions that have later labels or manual edits -> show transaction count and date range before deletion, then refresh dashboard and upload ledger after success.
- Preserving removed upload records means ledger needs status filtering or clear copy -> include status text and make removed rows visually secondary or filterable later.
- Existing prepared uploads are created before confirmation, so repeated prepare attempts can leave stale rows -> ledger status and delete behavior should make these visible; future cleanup can be separate.
- One large `App.tsx` may become harder to maintain -> keep extraction minimal for this change, but isolate import landing/flow helpers if the edit becomes too large.
- Date range based on transactions excludes unconfirmed uploads -> use empty display such as `Not imported` when min/max dates are absent.

## Migration Plan

1. Add API response models and endpoints for upload summaries and upload deletion.
2. If needed, add a schema migration for any new upload status values or indexes; current schema likely supports status changes without structural migration.
3. Add client types and API functions for list/delete upload summaries.
4. Refactor `/import` into upload ledger and `/import/new` into progressive import flow using existing import actions.
5. After confirm or delete, refresh upload summaries and dashboard data.
6. Rollback by hiding the ledger route changes and leaving existing upload source tables untouched.

## Open Questions

- Should removed upload rows stay visible by default, or should the landing table default to active/imported uploads only?
- Should delete require a typed confirmation when transaction count is high, or is a standard confirmation enough for local personal use?
