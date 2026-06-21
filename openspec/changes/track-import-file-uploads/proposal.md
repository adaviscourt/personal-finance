## Why

Imported transactions currently lack a user-facing file upload ledger, so removing a mistaken import requires finding individual transactions instead of deleting the source upload as one unit. The import page also grows by appending each stage, which makes review and backtracking harder than a guided file-import workflow should be.

## What Changes

- Add an import landing screen that lists past file uploads with file name, account, transaction count, imported transaction date range, and a delete action.
- Add upload-level deletion that removes all transactions associated with a selected file upload after user confirmation.
- Move the upload/import task behind an explicit upload entry point from the import landing screen.
- Replace the current appended import flow with separate progressive screens, a step progress tracker, and back navigation for each step.
- Keep the import flow visually restrained, table-first, and task-focused, following the product's FreeTaxUSA-inspired guidance.

## Capabilities

### New Capabilities
- `import-upload-management`: User-facing management of imported file uploads, including upload summaries and deletion of all transactions tied to an upload.

### Modified Capabilities
- `transaction-import`: Import module entry and workflow requirements change from one appended page flow to a landing screen plus separate progressive import steps.
- `csv-upload-preview`: CSV preview remains part of import, but its presentation moves into a dedicated step within the progressive import flow.

## Impact

- Import UI/routes for the upload ledger, upload entry point, progressive screens, progress tracker, and back controls.
- Import persistence model and APIs for linking transactions to upload records, summarizing uploads by account/count/date range, and deleting transactions by upload.
- Transaction queries and duplicate/import confirmation logic that depend on upload and raw-row source context.
- Tests for upload summaries, delete-by-upload behavior, and guided import navigation.
