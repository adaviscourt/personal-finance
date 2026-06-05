## 1. Backend Account API

- [x] 1.1 Add account request/response schemas including transaction count for list/delete warning flows (#24)
- [x] 1.2 Add endpoint to list accounts ordered by name with transaction counts (#24)
- [x] 1.3 Add endpoint to create accounts with non-empty unique name validation (#24)
- [x] 1.4 Add endpoint to rename accounts, changing name only and preserving other account fields (#24)
- [x] 1.5 Add account deletion endpoint that warns when transactions exist unless explicit confirmation is provided (#24)
- [x] 1.6 Ensure confirmed deletion handles related account-scoped data without foreign-key violations (#24)

## 2. Backend Workflow Integration

- [x] 2.1 Keep default account seeding idempotent and compatible with account listing (#24)
- [x] 2.2 Ensure import preparation rejects missing or deleted account selections before storing uploaded rows (#24)
- [x] 2.3 Ensure template creation/listing/update behavior supports active-account-scoped templates and global templates (#24)
- [x] 2.4 Extend dashboard spending-by-label endpoint to accept optional account id filters and default to all accounts (#24)

## 3. Frontend Account Management

- [x] 3.1 Add API client functions and types for listing, creating, renaming, and deleting accounts (#24)
- [x] 3.2 Add account management UI for account list, create, rename, and delete actions (#24)
- [x] 3.3 Show transaction-count warning and require confirmation before deleting accounts with transactions (#24)
- [x] 3.4 Load accounts on app startup and after account mutations (#24)

## 4. Frontend Workflow Integration

- [x] 4.1 Replace typed import account id input with active account selector (#24)
- [x] 4.2 Use active selected account when saving/listing/applying account-scoped import templates (#24)
- [x] 4.3 Add dashboard account multi-select that defaults to all accounts (#24)
- [x] 4.4 Update empty/error copy for missing accounts, deleted accounts, and no dashboard spending for selected accounts (#24)
- [x] 4.5 Update README workflow guidance to select the seeded default account instead of typing account id `1` (#24)

## 5. Verification

- [x] 5.1 Add backend tests for account list/create/rename/delete and transaction delete confirmation behavior (#24)
- [x] 5.2 Add backend tests for dashboard account filtering and all-accounts default behavior (#24)
- [x] 5.3 Add frontend tests for active account import/template selection and dashboard account multi-select (#24)
- [x] 5.4 Run backend tests (#24)
- [x] 5.5 Run frontend tests (#24)
