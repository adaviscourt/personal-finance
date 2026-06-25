## ADDED Requirements

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
