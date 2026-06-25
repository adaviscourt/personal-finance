## ADDED Requirements

### Requirement: Surface dashboard warnings
The system SHALL show a dashboard warning banner or icon above the monthly transaction review when one or more warnings are present, and SHALL hide the warning presentation when no warnings are present.

#### Scenario: Warnings present on dashboard
- **WHEN** the dashboard loads and one or more warnings exist
- **THEN** the dashboard shows a warning banner or icon above the monthly transaction review

#### Scenario: No warnings on dashboard
- **WHEN** the dashboard loads and no warnings exist
- **THEN** the dashboard does not show a warning banner or icon

### Requirement: Expand dashboard warnings
The system SHALL make the dashboard warning presentation expandable so users can reveal all current warnings.

#### Scenario: Warning banner collapsed
- **WHEN** the dashboard loads with warnings present
- **THEN** the warning presentation summarizes the warning state without requiring every warning to be visible

#### Scenario: User expands warnings
- **WHEN** the user expands the dashboard warning presentation
- **THEN** the dashboard reveals every current warning

### Requirement: Warn for stale account data
The system SHALL create one stale-data warning per account that has no transactions dated within the last 7 calendar days, including accounts with no transactions.

#### Scenario: Account has recent transaction
- **WHEN** an account has at least one transaction dated within the last 7 calendar days
- **THEN** the dashboard does not show a stale-data warning for that account

#### Scenario: Account has only stale transactions
- **WHEN** an account's latest transaction is older than 7 calendar days
- **THEN** the dashboard shows one stale-data warning for that account

#### Scenario: Account has no transactions
- **WHEN** an account has no transactions
- **THEN** the dashboard shows one stale-data warning for that account

#### Scenario: Multiple accounts are stale
- **WHEN** multiple accounts have no transactions dated within the last 7 calendar days
- **THEN** the dashboard shows exactly one stale-data warning for each affected account

### Requirement: Provide dashboard warnings data
The system SHALL provide dashboard warning data that identifies each warning's type, affected account, latest transaction date when present, display message, and action target needed by the dashboard UI.

#### Scenario: Dashboard requests warning data
- **WHEN** the dashboard loads warning state
- **THEN** the system returns warning data for all current account warnings independent of the selected dashboard month and transaction filters

#### Scenario: Warning includes action target
- **WHEN** the system returns a stale-data warning
- **THEN** the warning includes the affected account identifier needed to open imports with that account selected
