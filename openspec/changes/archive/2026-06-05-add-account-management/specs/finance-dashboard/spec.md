## MODIFIED Requirements

### Requirement: Select dashboard month
The system SHALL allow a user to select a month for the finance dashboard while preserving the selected account filter.

#### Scenario: Month selected
- **WHEN** the user selects a month
- **THEN** the dashboard uses transactions from that month and the selected account filter for its visualizations

## ADDED Requirements

### Requirement: Filter dashboard by accounts
The system SHALL allow users to filter dashboard spending by multiple selected accounts and SHALL default to all accounts.

#### Scenario: All accounts default
- **WHEN** the user has not selected specific dashboard accounts
- **THEN** the dashboard includes debit transactions from all accounts for the selected month

#### Scenario: Specific accounts selected
- **WHEN** the user selects one or more dashboard accounts
- **THEN** the dashboard includes only debit transactions from the selected accounts for the selected month

#### Scenario: Selected account has no spending
- **WHEN** the selected account filter and month have no debit transactions
- **THEN** the dashboard communicates that no spending data is available for that month and account selection
