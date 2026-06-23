## Why

Dashboard review has label filtering, but users cannot filter by label controllability or inspect rows hidden by label selection. The net activity trend also shows surrounding months but does not let users move the active month from the chart.

## What Changes

- Add a dashboard controllability filter for controllable labels, non-controllable labels, or both.
- Change the label bulk action text from "Select all labels" to "Deselect all labels" when every label is currently checked.
- Add a dashboard toggle that shows label-filter-hidden transaction rows in the table, with hidden rows visually greyed out and excluded from summaries.
- Make each net activity graph month point selectable so clicking it updates the dashboard month filter to that month.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `finance-dashboard`: Expand dashboard filtering and trend interaction requirements.

## Impact

- Frontend dashboard state, persistence, label filter controls, transaction table rendering, KPI/spending/net calculations, and net activity chart interactions.
- Dashboard transaction API filter parameters and response metadata if needed to support controllability filtering and hidden-row display.
- Backend dashboard transaction query tests and frontend dashboard/API tests.
