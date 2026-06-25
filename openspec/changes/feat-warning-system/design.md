## Context

The dashboard already loads accounts for filters and dashboard transaction rows from `/dashboard/transactions`. The import workflow keeps its selected account in `activeAccountId`, and account changes refresh account-scoped import templates. Issue #66 adds dashboard warnings, starting with stale-data warnings for accounts with no transactions in the last 7 days.

## Goals / Non-Goals

**Goals:**
- Surface account warnings on the dashboard before monthly transaction review.
- Keep warning state account-scoped, expandable, and actionable.
- Route stale-data warning actions to the import workflow with the affected account preselected.
- Define behavior for the 7-day staleness threshold clearly enough to test.

**Non-Goals:**
- Add user-configurable warning thresholds.
- Add warning persistence, dismissal, snooze, or notification delivery.
- Add warning types beyond stale account data.
- Change import confirmation, duplicate detection, or dashboard summary calculations.

## Decisions

- Compute stale-data warnings from each active account's latest transaction date rather than the currently selected dashboard month. This avoids hiding stale accounts when the dashboard is filtered to a month or subset of accounts. Alternative considered: reuse current dashboard transaction rows, but that would make warnings filter-dependent and miss accounts excluded by filters.
- Treat an account as stale when it has no transactions dated within the last 7 calendar days, including accounts with no transactions. Alternative considered: warn only after at least one prior transaction exists, but issue text says no transactions within the last 7 days per account.
- Add warning data as a small account freshness/dashboard warning API response or equivalent client data path that returns account id, account name, latest transaction date, warning type, and action target. Alternative considered: derive fully in the frontend from multiple dashboard month calls, but that is inefficient and unreliable across month boundaries.
- Use existing import account selection state for preselection. The warning action should switch to the import module/section, set `activeAccountId` to the warning account, reset import progress to the account/source starting state as needed, and let existing template loading react to the selected account. Alternative considered: encode account selection only in query string; useful for deep links, but not required if the current app remains single-page stateful.
- Render the warning banner collapsed by default when warnings exist, with count/icon summary and an accessible expand/collapse control. Alternative considered: always render all warnings, but issue asks for expandable warning banner.

## Risks / Trade-offs

- Staleness uses current date, so tests can become time-sensitive -> inject or isolate current-date calculation in the warning builder tests.
- Latest transaction data can be expensive if calculated naively per account -> aggregate latest transaction date by account in one backend query or one shared in-memory demo pass.
- Navigating from dashboard to import can discard in-progress import state -> only reset import draft when needed, and prefer preserving safe existing account-change behavior.
- Accounts with no transactions will always warn -> copy should clarify that no recent transactions were found and action is to import for that account.

## Migration Plan

- No data migration required.
- Add API/client/demo warning support, dashboard UI, and import preselection behavior behind normal app code paths.
- Rollback by removing warning UI/API usage; persisted transaction/account data remains unchanged.

## Open Questions

- None for planning scope.
