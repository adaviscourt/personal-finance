## ADDED Requirements

### Requirement: Select dashboard month
The system SHALL allow a user to select a month for the finance dashboard.

#### Scenario: Month selected
- **WHEN** the user selects a month
- **THEN** the dashboard uses transactions from that month for its visualizations

### Requirement: Show spending by label pie chart
The system SHALL display a pie chart of transaction totals grouped by label for the selected month.

#### Scenario: Pie chart rendered
- **WHEN** the selected month has transactions
- **THEN** the dashboard shows label groups with their corresponding totals

### Requirement: Exclude credits from spending chart
The system SHALL calculate the spending-by-label pie chart from debit transactions only.

#### Scenario: Credits present in selected month
- **WHEN** the selected month includes both debit and credit transactions
- **THEN** the pie chart totals include debit transactions and exclude credit transactions

### Requirement: Show empty dashboard state
The system SHALL show an empty state when the selected month has no chartable transactions.

#### Scenario: No transactions for month
- **WHEN** the user selects a month with no debit transactions
- **THEN** the dashboard communicates that no spending data is available for that month
