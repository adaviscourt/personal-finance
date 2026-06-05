## Approval
Approver: adaviscourt
Date: 2026/06/04

## Why

The app currently relies on a seeded `Default Account` with an assumed id of `1`, which makes first import setup easy but leaves users without a way to manage real accounts. Account management is needed so imports, templates, and dashboard analysis can target user-defined accounts instead of hardcoded setup guidance.

## What Changes

- Add account management so users can list accounts, create accounts, rename accounts, and delete accounts.
- Limit account editing to the account name only.
- Warn before deleting accounts that already have transactions and require explicit confirmation before deletion proceeds.
- Replace manual account id entry during import/template workflows with active-account selection.
- Scope import templates to the active account while still supporting globally reusable templates.
- Add dashboard account filtering with multi-select account choices, defaulting to all accounts alongside the existing month filter.
- Keep seeded `Default Account` as a bootstrap fallback for clean databases until users create or choose their own accounts.

## Capabilities

### New Capabilities

- `account-management`: Defines account listing, creation, name editing, deletion, and transaction-linked delete confirmation behavior.

### Modified Capabilities

- `transaction-import`: Import preparation uses an active selected account instead of manually typed account id guidance.
- `import-templates`: Template creation, listing, and application use the active selected account for account-scoped templates.
- `finance-dashboard`: Dashboard spending-by-label filtering supports multi-select accounts and defaults to all accounts.

## Impact

- Backend API: new account endpoints and adjusted dashboard account filtering query parameters.
- Backend persistence: existing `accounts` table is reused; delete behavior must handle related uploads, templates, transactions, and duplicate detection constraints safely.
- Frontend UI: account management surface, active account selector for import/template flows, dashboard account multi-select.
- Tests: backend account API/delete behavior, import/template account selection, dashboard account filtering, and frontend workflow coverage.
