## 1. Backend Upload Management

- [x] 1.1 Add API response models for import upload summaries and delete results.
- [x] 1.2 Implement `GET /imports/uploads` with account name, status, row count, imported transaction count, min/max transaction dates, and created timestamp.
- [x] 1.3 Implement `DELETE /imports/uploads/{upload_file_id}` to delete linked transactions, preserve upload/raw rows, mark upload removed, and return deleted count.
- [x] 1.4 Add or confirm indexes needed for upload summary and delete queries.

## 2. Frontend API Client

- [x] 2.1 Add upload summary and delete response types to `frontend/src/api/client.ts`.
- [x] 2.2 Add client functions for listing import uploads and deleting upload transactions.

## 3. Import Landing Page

- [x] 3.1 Replace `/import` primary content with upload ledger loading, empty, error, and table states.
- [x] 3.2 Show file name, account, status, imported transaction count, imported date range, upload date, and delete action in the ledger.
- [x] 3.3 Add upload action from the ledger to open the guided import flow without appending it below the table.
- [x] 3.4 Add delete confirmation UI, call the delete endpoint, refresh upload summaries, and refresh dashboard data after success.

## 4. Guided Import Flow

- [x] 4.1 Move the current import controls into a separate `/import/new` flow or equivalent route-level screen.
- [x] 4.2 Split the flow into focused account, source CSV preview, template mapping, transformed review, and confirmation steps.
- [x] 4.3 Add a step progress tracker that marks current, complete, and unavailable future steps.
- [x] 4.4 Add back actions for steps after account selection while preserving valid earlier inputs.
- [x] 4.5 Clear downstream preview, transformed preview, duplicate warning, and confirmation state when account, file, or mappings change.
- [x] 4.6 After successful confirmation, show imported count and a path to dashboard review, and refresh upload summaries.

## 5. Styling And Accessibility

- [x] 5.1 Style the upload ledger and guided flow with existing restrained table, button, form, focus, and status patterns.
- [x] 5.2 Ensure table controls, step tracker, back buttons, validation messages, and delete confirmation are keyboard accessible and use non-color status cues.
- [x] 5.3 Verify responsive behavior for the upload table and guided steps on narrow screens.

## 6. Tests And Verification

- [x] 6.1 Add backend tests for upload summary count/date-range/status behavior.
- [x] 6.2 Add backend tests for delete-by-upload success, missing upload, preserved raw rows, and removed status.
- [x] 6.3 Add frontend tests for import landing empty/table states, upload navigation, progressive step navigation, and delete refresh behavior.
- [x] 6.4 Run backend, frontend, and OpenSpec validation commands.
