## Purpose

Defines finance dashboard month selection, filters, summaries, and transaction review behavior.
## Requirements
### Requirement: Select dashboard month
The system SHALL allow a user to select a month for the finance dashboard while preserving selected account, label, and controllability filters.

#### Scenario: Month selected
- **WHEN** the user selects a month
- **THEN** the dashboard uses transactions from that month and the selected account, label, and controllability filters for its table and summaries

#### Scenario: Net activity point selected
- **WHEN** the user clicks a month point on the net activity graph
- **THEN** the dashboard date filter changes to that point's month and refreshes the table and summaries for the selected filters

### Requirement: Show dashboard-only home page
The system SHALL make the home page a dashboard-only surface for transaction review.

#### Scenario: User opens home page
- **WHEN** the user opens the root app route
- **THEN** the page shows dashboard filters and transaction review content without import forms, label rule forms, account management forms, or persistent backend health status

### Requirement: List dashboard transactions
The system SHALL show a table of transactions for the selected dashboard filters.

#### Scenario: Transactions exist for selected filters
- **WHEN** the selected month and optional filters match transactions
- **THEN** the dashboard displays those transactions in a table with date, account, description or merchant, label, direction, and amount

#### Scenario: Transaction rows ordered
- **WHEN** the dashboard displays matching transactions
- **THEN** transactions are ordered predictably by transaction date with stable ordering for transactions on the same date

### Requirement: Show empty dashboard state
The system SHALL show an empty state when the selected filters have no matching transactions.

#### Scenario: No transactions for filters
- **WHEN** the user selects a month, account filter, or label filter with no matching transactions
- **THEN** the dashboard communicates that no transactions are available for the selected filters

### Requirement: Filter dashboard by accounts
The system SHALL allow users to filter dashboard transactions by multiple selected accounts and SHALL default to all accounts.

#### Scenario: All accounts default
- **WHEN** the user has not selected specific dashboard accounts
- **THEN** the dashboard includes transactions from all accounts for the selected month and label filter

#### Scenario: Specific accounts selected
- **WHEN** the user selects one or more dashboard accounts
- **THEN** the dashboard includes only transactions from the selected accounts for the selected month and label filter

#### Scenario: Selected account has no transactions
- **WHEN** the selected account filter, label filter, and month have no transactions
- **THEN** the dashboard communicates that no transactions are available for the selected filters

### Requirement: Filter dashboard by label
The system SHALL allow users to filter dashboard transactions by multiple selected labels and SHALL default to all labels.

#### Scenario: All labels default
- **WHEN** the user has not selected dashboard label filters
- **THEN** the dashboard includes transactions with any label and uncategorized transactions for the selected month and account filter

#### Scenario: Specific labels selected
- **WHEN** the user selects one or more label filters
- **THEN** the dashboard includes only transactions assigned to one of the selected labels for the selected month and account filter

#### Scenario: Uncategorized label selected
- **WHEN** the user selects the uncategorized label filter
- **THEN** the dashboard includes only transactions without an assigned label for the selected month and account filter

### Requirement: Provide dashboard transaction data API
The system SHALL provide an API for dashboard transaction rows filtered by month and optional account, label, and label controllability filters, including account display data and label controllability metadata.

#### Scenario: Dashboard requests transaction rows
- **WHEN** the frontend requests dashboard transactions for a valid month
- **THEN** the API returns transactions for that month with account, label display data, and label controllability data needed by the dashboard table and summaries

#### Scenario: Dashboard requests filtered transaction rows
- **WHEN** the frontend requests dashboard transactions with account, label, or label controllability filters
- **THEN** the API returns only transactions matching the selected filters

### Requirement: Persist dashboard filters
The system SHALL persist selected dashboard month, account filters, and label filters across page refreshes.

#### Scenario: Dashboard filters changed
- **WHEN** the user changes dashboard month, account filters, or label filters
- **THEN** the dashboard stores those selections for the next page load

#### Scenario: Dashboard reloaded
- **WHEN** the user reloads the dashboard after changing filters
- **THEN** the dashboard restores the previously selected month, accounts, and labels when those options are still available

### Requirement: Sort dashboard transactions
The system SHALL allow users to sort dashboard transactions by visible table columns and show direction only for the active sort column.

#### Scenario: Sort column selected
- **WHEN** the user selects a sortable dashboard transaction column
- **THEN** the dashboard orders rows by that column and displays the active sort direction indicator on that column

### Requirement: Show activity KPI cards
The system SHALL show debit activity, credit activity, and net activity KPI cards for the selected dashboard filters.

#### Scenario: Dashboard transactions loaded
- **WHEN** dashboard transactions load for selected filters
- **THEN** debit activity totals debits, credit activity totals credits, and net activity shows credits minus debits

### Requirement: Split activity by controllability
The system SHALL split activity totals into controllable and non-controllable groups using transaction label metadata.

#### Scenario: Labeled transactions loaded
- **WHEN** dashboard transactions include labels with controllability metadata
- **THEN** the dashboard groups matching debit and credit activity into controllable and non-controllable totals and counts

### Requirement: Show spending bars with amounts
The system SHALL show debit spending grouped by label as bars sorted by amount descending, with amount values visible beside each label.

#### Scenario: Debit spending exists
- **WHEN** selected dashboard filters include debit transactions
- **THEN** the dashboard displays label spending bars ordered from highest amount to lowest amount

### Requirement: Show seven-month net activity trend
The system SHALL show a seven-month net activity trend around the selected month with exact amount tooltips available on hover or focus.

#### Scenario: Net trend rendered
- **WHEN** the dashboard loads net activity data for the selected month window
- **THEN** the dashboard renders a line chart covering seven months and exposes exact point amounts on hover or focus

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

### Requirement: Populate dashboard with demo data
The system SHALL populate the dashboard in demo mode with deterministic synthetic transactions and labels that demonstrate realistic personal finance review for a young single US user earning about $100k in a MCOL city.

#### Scenario: Demo dashboard loads
- **WHEN** a visitor opens the dashboard in demo mode
- **THEN** the dashboard shows seeded account filters, label filters, transaction rows, KPI cards, spending bars, and net activity trend data without requiring file upload

#### Scenario: Demo filters exercised
- **WHEN** a visitor changes the demo dashboard month, account filters, or label filters
- **THEN** the dashboard updates using seeded synthetic transactions that include salary income, rent, groceries, utilities, transportation, insurance, subscriptions, dining, entertainment, fitness, travel, savings, and hobby activity

#### Scenario: Demo dashboard has uncategorized examples
- **WHEN** the visitor filters or reviews demo transactions by label
- **THEN** at least some seeded transactions demonstrate uncategorized or relabeling opportunities without containing real personal data

