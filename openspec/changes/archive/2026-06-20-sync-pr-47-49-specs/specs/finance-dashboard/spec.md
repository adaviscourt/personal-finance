## ADDED Requirements

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

## MODIFIED Requirements

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
- **THEN** the dashboard includes transactions without an assigned label for the selected month and account filter

### Requirement: Provide dashboard transaction data API
The system SHALL provide an API for dashboard transaction rows filtered by month and optional account and label filters, including account display data and label controllability metadata.

#### Scenario: Dashboard requests transaction rows
- **WHEN** the frontend requests dashboard transactions for a valid month
- **THEN** the API returns transactions for that month with account, label display data, and label controllability data needed by the dashboard table and summaries

#### Scenario: Dashboard requests filtered transaction rows
- **WHEN** the frontend requests dashboard transactions with account or label filters
- **THEN** the API returns only transactions matching the selected filters
