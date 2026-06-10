## ADDED Requirements

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

### Requirement: Filter dashboard by label
The system SHALL allow users to filter dashboard transactions by label and SHALL default to all labels.

#### Scenario: All labels default
- **WHEN** the user has not selected a dashboard label filter
- **THEN** the dashboard includes transactions with any label and uncategorized transactions for the selected month and account filter

#### Scenario: Specific label selected
- **WHEN** the user selects a label filter
- **THEN** the dashboard includes only transactions assigned to the selected label for the selected month and account filter

#### Scenario: Uncategorized label selected
- **WHEN** the user selects the uncategorized label filter
- **THEN** the dashboard includes only transactions without an assigned label for the selected month and account filter

### Requirement: Provide dashboard transaction data API
The system SHALL provide an API for dashboard transaction rows filtered by month and optional account and label filters.

#### Scenario: Dashboard requests transaction rows
- **WHEN** the frontend requests dashboard transactions for a valid month
- **THEN** the API returns transactions for that month with account and label display data needed by the dashboard table

#### Scenario: Dashboard requests filtered transaction rows
- **WHEN** the frontend requests dashboard transactions with account or label filters
- **THEN** the API returns only transactions matching the selected filters

## MODIFIED Requirements

### Requirement: Select dashboard month
The system SHALL allow a user to select a month for the finance dashboard while preserving selected account and label filters.

#### Scenario: Month selected
- **WHEN** the user selects a month
- **THEN** the dashboard uses transactions from that month and the selected account and label filters for its table and summaries

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

## REMOVED Requirements

### Requirement: Show spending by label pie chart
**Reason**: The dashboard is changing from chart-first spending visualization to transaction-table-first review. Label summaries may remain, but a pie chart is no longer required as the primary dashboard behavior.
**Migration**: Use the new transaction table and optional spending summary behavior for dashboard review.

### Requirement: Exclude credits from spending chart
**Reason**: The removed chart-specific requirement no longer defines primary dashboard behavior. Transaction rows must include both debits and credits so the monthly review is complete.
**Migration**: If a spending summary remains, keep debit-only spending totals within that summary while the transaction table includes all transaction directions.
