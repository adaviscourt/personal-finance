## Context

The backend already has an `accounts` table and all imported transactions require an `account_id`. The current user path depends on a seeded `Default Account` and frontend copy that tells users to use account id `1`, which works for a clean database but does not scale to multiple real accounts.

The frontend has one main workflow screen for CSV preview, template setup, import preparation, label rules, and dashboard charts. Account selection needs to be available where it changes behavior without turning the MVP into a full banking-product account model.

## Goals / Non-Goals

**Goals:**

- Let users list, create, rename, and delete accounts.
- Keep account editing limited to name changes.
- Require explicit confirmation before deleting an account with transactions.
- Use a selected active account for import preparation and account-scoped template workflows.
- Let dashboard users filter spending by multiple accounts, defaulting to all accounts.
- Preserve seeded `Default Account` as a clean-database bootstrap fallback.

**Non-Goals:**

- Account sync, balances, credentials, or external financial institution integrations.
- Editing account institution or account type in the UI.
- Per-account dashboard defaults or persisted user preferences.
- User authentication or multi-user ownership boundaries.

## Decisions

### Reuse existing `accounts` table

Use the current `Account` model as the source of truth. Add API/UI behavior around it instead of adding a new account profile model.

Alternative considered: introduce a richer account settings model. Rejected because current import, duplicate detection, templates, and dashboard already key off `accounts.id`; more schema now would add surface area without a clear MVP need.

### Keep seeded default account

Continue seeding `Default Account` during startup so clean Docker volumes still have a valid account before the user creates any. Treat it as ordinary data in account management rather than a protected system account.

Alternative considered: remove seed and force account creation before import. Rejected because it would add first-run friction and complicate existing tests and README setup.

### Name-only account editing

Expose rename only. Keep `institution` and `account_type` backend fields unchanged for seeded/default metadata and possible future use.

Alternative considered: expose all fields. Rejected because the user specifically scoped editing to name only, and additional fields create validation/copy/UI work that does not affect current workflows.

### Delete with transaction warning and explicit confirmation

Account deletion should surface whether the account has transactions. If transactions exist, the user must confirm a destructive delete. The implementation should make the destructive behavior explicit in the API, for example with a confirmation flag or dedicated confirmed-delete path.

Because transactions, uploads, templates, and duplicate detection reference accounts, deletion must either cascade related records intentionally or block unless forced. For this MVP, confirmed deletion should remove or detach related account-scoped data consistently so no foreign-key violations remain.

Alternative considered: never allow deleting accounts with transactions. Rejected because the requested behavior is warning plus confirmation, not permanent blocking.

### Active account for import/template workflows

Replace typed account id entry with an active account selector backed by the account list. The selected account id is still sent to existing import/template APIs, but the UI no longer asks users to know raw ids.

Alternative considered: infer account from template only. Rejected because global templates exist and imports need explicit account context for duplicate detection and persisted transactions.

### Dashboard account multi-select defaults to all accounts

The dashboard keeps month selection and adds account multi-select. With no specific accounts selected, the query includes all accounts. With one or more selected accounts, the backend filters debit spending by those account ids.

Alternative considered: single active account dashboard. Rejected because user requested multi-select and default all accounts for cross-account spending review.

## Risks / Trade-offs

- Deleting accounts with transactions can remove meaningful history -> Require explicit confirmation, show transaction count, and cover behavior with tests.
- Cascading deletes can surprise users if related uploads/templates disappear -> UI copy must name that linked data may be affected before confirmation.
- Seeded default account id `1` may remain in old docs/tests after account selector work -> Update docs/tests to describe selecting the default account, not typing id `1`.
- Dashboard account filters can diverge between frontend empty-selection meaning and backend omitted-query meaning -> Define empty account filter as all accounts in spec and test both paths.
