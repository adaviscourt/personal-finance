## 1. Backend Filters

- [ ] 1.1 Add dashboard transaction API support for a controllability filter parameter with allowed values for both, controllable, and non-controllable labels.
- [ ] 1.2 Apply controllability filtering to labeled and uncategorized dashboard transaction rows using display-label controllability metadata.
- [ ] 1.3 Add backend tests for controllable-only, non-controllable-only, and both-mode transaction filtering.

## 2. Frontend Filter State

- [ ] 2.1 Add dashboard controllability filter state, default it to both, and include it in dashboard transaction/spending/net trend requests.
- [ ] 2.2 Add hidden-label-row toggle state that defaults off and only broadens label filtering when enabled.
- [ ] 2.3 Keep existing month, account, and label filter behavior intact when controllability or hidden-row settings change.

## 3. Dashboard Controls And Table

- [ ] 3.1 Add dashboard UI control for controllable, non-controllable, or both label filtering.
- [ ] 3.2 Change the label bulk action to show "Select all labels" when any label is unchecked and "Deselect all labels" when all labels are checked.
- [ ] 3.3 Implement the hidden-records toggle and mark deselected-label rows as hidden only when the toggle is enabled.
- [ ] 3.4 Style hidden transaction rows as greyed out while preserving sortable table behavior.

## 4. Summaries And Net Activity

- [ ] 4.1 Ensure KPI cards, spending summary, and net activity calculations exclude rows hidden by deselected labels.
- [ ] 4.2 Make net activity graph month points clickable and update the dashboard month filter to the clicked month.
- [ ] 4.3 Preserve focus/tooltip accessibility for net activity points after adding selection behavior.

## 5. Verification

- [ ] 5.1 Add or update frontend tests for controllability filter requests, select/deselect label action text, hidden-row display, hidden-row summary exclusion, and net activity point month selection.
- [ ] 5.2 Run backend dashboard tests.
- [ ] 5.3 Run frontend tests for dashboard/API behavior.
- [ ] 5.4 Run `openspec validate feat-expand-filter-capabilities --strict`.
