## Why

Users need a visible dashboard signal when account data may be out of date, so stale transaction data is not mistaken for current finances. This is needed now because dashboard review depends on recent imports, but the app does not currently surface stale account data or provide a direct remediation path.

## What Changes

- Add dashboard warning presentation above monthly transaction review.
- Show a warning banner or icon when one or more warnings are present.
- Allow the warning presentation to expand and reveal all current warnings.
- Add a stale-data warning type when an account has no transactions within the last 7 days.
- Provide one stale-data warning per affected account.
- Add an action beside each stale-data warning that navigates to imports with that account preselected.

## Capabilities

### New Capabilities

### Modified Capabilities
- `finance-dashboard`: Dashboard requirements expand to surface expandable account warnings above monthly transaction review.
- `transaction-import`: Import workflow requirements expand to support dashboard warning actions that open imports with an account preselected.

## Impact

- Dashboard UI and data loading need account warning state derived from latest transaction dates.
- Import module routing/state needs a way to accept an account selection from dashboard warning actions.
- Tests need coverage for absent/present warnings, multi-account expansion, stale-date boundaries, and import navigation with preselected account.
