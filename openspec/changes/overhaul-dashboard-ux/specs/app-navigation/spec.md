## ADDED Requirements

### Requirement: Provide app module navigation
The system SHALL provide navigation between dashboard, import, labeling, and account management modules.

#### Scenario: User opens app navigation
- **WHEN** the user views any primary app module
- **THEN** navigation links for dashboard, import, labeling, and accounts are available

#### Scenario: User selects a module
- **WHEN** the user selects a module navigation link
- **THEN** the app displays the selected module without requiring a full page reload

### Requirement: Indicate active module
The system SHALL indicate which primary module is currently active.

#### Scenario: Dashboard route active
- **WHEN** the user views the dashboard route
- **THEN** the dashboard navigation item is marked as current

#### Scenario: Non-dashboard route active
- **WHEN** the user views import, labeling, or account management
- **THEN** the corresponding navigation item is marked as current

### Requirement: Keep development health status out of app navigation
The system SHALL NOT show backend health checks or database status in primary user navigation.

#### Scenario: User views navigation
- **WHEN** the user views the app navigation
- **THEN** backend health and database status are not shown as persistent navigation content
