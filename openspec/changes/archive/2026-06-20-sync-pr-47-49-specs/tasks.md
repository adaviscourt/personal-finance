## 1. Dashboard Sync

- [x] 1.1 Verify dashboard table supports sortable columns with active direction indicator only.
- [x] 1.2 Verify dashboard month, account, and label filters persist across refreshes.
- [x] 1.3 Verify debit activity, credit activity, and net activity KPI cards use selected filters.
- [x] 1.4 Verify controllable and non-controllable activity splits use label metadata.
- [x] 1.5 Verify spending bars show amounts and sort by amount descending.
- [x] 1.6 Verify seven-month net activity trend renders exact values on hover or focus.

## 2. Import, Templates, and Transforms Sync

- [x] 2.1 Verify import workflow progresses from account selection through upload, CSV preview, template mapping, transformed preview, warning review, and confirmation.
- [x] 2.2 Verify import confirmation is gated until a transformed preview exists.
- [x] 2.3 Verify visible prepare errors appear for missing inputs, invalid mappings, and split transform failures.
- [x] 2.4 Verify templates store and reload split debit and credit source columns.
- [x] 2.5 Verify split amount and split direction transforms handle debit values, credit values, and dash placeholders.
- [x] 2.6 Verify split transforms reject rows with both split columns empty or both populated.

## 3. Labeling Sync

- [x] 3.1 Verify custom labels can be created with global or account scope and controllable metadata.
- [x] 3.2 Verify duplicate label prevention uses name, scope, and controllability.
- [x] 3.3 Verify label rules inherit account scope from the selected label.
- [x] 3.4 Verify description contains and regex rules can be previewed and saved.
- [x] 3.5 Verify invalid regex patterns are rejected with validation feedback.
- [x] 3.6 Verify label rule edits clear prior rule-applied labels and apply updated matches.
- [x] 3.7 Verify label rule deletion removes the rule and clears labels applied by that rule.
- [x] 3.8 Verify label lists distinguish global, account-scoped, controllable, and non-controllable labels.

## 4. Account and Persistence Sync

- [x] 4.1 Verify account selection scopes uploads, duplicate detection, imported transactions, templates, labels, and rules where required.
- [x] 4.2 Verify dashboard supports multiple selected account filters.
- [x] 4.3 Verify SQLite startup migrations add label scope, controllability, rule scope, match type, and transaction rule provenance columns idempotently.
- [x] 4.4 Verify backend tests use temporary SQLite databases instead of mutating the local development database.

## 5. Deployment Sync

- [x] 5.1 Verify Docker build compiles the frontend and copies static assets into the backend image.
- [x] 5.2 Verify production container serves UI and API on port 8000.
- [x] 5.3 Verify production `DATABASE_URL` defaults to `sqlite:////data/personal_finance.db`.
- [x] 5.4 Verify GitHub release workflow builds, pushes, and attests GHCR images.
- [x] 5.5 Verify Unraid template configures GHCR image, port 8000, `/data` appdata path, and database URL.
- [x] 5.6 Verify README documents Unraid installation and persistent data requirements.

## 6. Verification

- [x] 6.1 Verify backend test suite covers updated import, dashboard, labeling, database, and transform behavior.
- [x] 6.2 Verify frontend test suite covers updated dashboard, import, labeling, and API client behavior.
- [x] 6.3 Verify frontend production build passes.
- [x] 6.4 Verify PR screenshots cover dashboard, import, labeling, and accounts on desktop and mobile.
