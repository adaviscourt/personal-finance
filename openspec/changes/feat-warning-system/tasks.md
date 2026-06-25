## 1. Warning Data

- [ ] 1.1 Add stale-account warning derivation from each active account's latest transaction date, including accounts with no transactions.
- [ ] 1.2 Ensure stale-data warnings use a 7 calendar day threshold and are independent of selected dashboard month, account filters, label filters, and controllability filters.
- [ ] 1.3 Expose warning data to the dashboard with warning type, affected account id/name, latest transaction date when present, display message, and import action target.
- [ ] 1.4 Add backend or data-layer tests for recent, stale, no-transaction, and multi-account warning cases.

## 2. Dashboard Warning UI

- [ ] 2.1 Render a warning banner or icon above monthly transaction review only when warnings exist.
- [ ] 2.2 Make the warning presentation collapsed by default with summary/count state and an accessible expand/collapse control.
- [ ] 2.3 Reveal all current warnings when expanded, with one stale-data warning per affected account.
- [ ] 2.4 Add dashboard tests for hidden no-warning state, present warning state, expansion, and multiple account warnings.

## 3. Import Action Routing

- [ ] 3.1 Add warning action behavior that navigates from dashboard warning to imports with the affected account preselected.
- [ ] 3.2 Reuse existing import account selection behavior so account-scoped templates/context load for the preselected account.
- [ ] 3.3 Handle stale warning actions for unavailable accounts without selecting an invalid account.
- [ ] 3.4 Add frontend tests for warning action navigation and import account preselection.

## 4. Verification

- [ ] 4.1 Run relevant backend tests for warning derivation/API behavior.
- [ ] 4.2 Run relevant frontend tests for dashboard warning UI and import preselection.
- [ ] 4.3 Run `openspec validate feat-warning-system --strict` before requesting implementation review.
