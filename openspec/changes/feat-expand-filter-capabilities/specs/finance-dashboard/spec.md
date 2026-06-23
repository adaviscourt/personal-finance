## ADDED Requirements

### Requirement: Filter dashboard by label controllability
The system SHALL allow users to filter dashboard transactions and summaries by controllable labels, non-controllable labels, or both, and SHALL default to both.

#### Scenario: Both controllability groups selected
- **WHEN** the controllability filter is set to both
- **THEN** the dashboard includes transactions with controllable labels, transactions with non-controllable labels, and uncategorized transactions that match the selected month, account, and label filters

#### Scenario: Controllable labels selected
- **WHEN** the user filters the dashboard to controllable labels
- **THEN** the dashboard includes only transactions whose display label is controllable and matches the selected month, account, and label filters

#### Scenario: Non-controllable labels selected
- **WHEN** the user filters the dashboard to non-controllable labels
- **THEN** the dashboard includes only transactions whose display label is non-controllable and matches the selected month, account, and label filters

### Requirement: Toggle all dashboard labels
The system SHALL provide a dashboard label bulk action whose text and behavior reflect whether all labels are currently checked.

#### Scenario: Not all labels are checked
- **WHEN** at least one dashboard label is unchecked
- **THEN** the label bulk action is shown as "Select all labels" and checking it selects every label

#### Scenario: All labels are checked
- **WHEN** every dashboard label is checked
- **THEN** the label bulk action is shown as "Deselect all labels" and clicking it deselects every label

### Requirement: Show label-hidden dashboard transactions
The system SHALL allow users to reveal transaction rows hidden by deselected dashboard labels while keeping those rows visually distinct and excluded from dashboard summaries.

#### Scenario: Hidden rows toggle is off
- **WHEN** the user has deselected one or more labels and hidden rows are not enabled
- **THEN** the dashboard transaction table, KPI cards, spending summary, and net activity trend include only rows whose labels are selected

#### Scenario: Hidden rows toggle is on
- **WHEN** the user has deselected one or more labels and enables hidden rows
- **THEN** the dashboard transaction table includes rows whose labels are selected and rows hidden by deselected labels for the selected month, account, and controllability filters
- **AND** rows hidden by deselected labels are greyed out in the table
- **AND** KPI cards, spending summary, and net activity trend continue to exclude rows hidden by deselected labels

#### Scenario: All labels are selected with hidden rows enabled
- **WHEN** every dashboard label is selected and hidden rows are enabled
- **THEN** no dashboard transaction row is treated as hidden by label filtering

## MODIFIED Requirements

### Requirement: Select dashboard month
The system SHALL allow a user to select a month for the finance dashboard while preserving selected account, label, and controllability filters.

#### Scenario: Month selected
- **WHEN** the user selects a month
- **THEN** the dashboard uses transactions from that month and the selected account, label, and controllability filters for its table and summaries

#### Scenario: Net activity point selected
- **WHEN** the user clicks a month point on the net activity graph
- **THEN** the dashboard date filter changes to that point's month and refreshes the table and summaries for the selected filters

### Requirement: Provide dashboard transaction data API
The system SHALL provide an API for dashboard transaction rows filtered by month and optional account, label, and label controllability filters, including account display data and label controllability metadata.

#### Scenario: Dashboard requests transaction rows
- **WHEN** the frontend requests dashboard transactions for a valid month
- **THEN** the API returns transactions for that month with account, label display data, and label controllability data needed by the dashboard table and summaries

#### Scenario: Dashboard requests filtered transaction rows
- **WHEN** the frontend requests dashboard transactions with account, label, or label controllability filters
- **THEN** the API returns only transactions matching the selected filters
