## ADDED Requirements

### Requirement: Provide dedicated labeling module
The system SHALL provide a dedicated labeling module for transaction label rule management.

#### Scenario: User opens labeling module
- **WHEN** the user opens the labeling module
- **THEN** label rule creation and existing label rule review are available there instead of on the dashboard home page

### Requirement: Keep labels available to dashboard filters
The system SHALL make the fixed label taxonomy available for dashboard label filtering.

#### Scenario: User views dashboard label filter
- **WHEN** the dashboard loads labels successfully
- **THEN** the dashboard offers the fixed labels and an all-labels default for filtering transactions

#### Scenario: User filters by label after rule changes
- **WHEN** the user creates a label rule and returns to the dashboard
- **THEN** matching transactions can be reviewed through the dashboard label filter
