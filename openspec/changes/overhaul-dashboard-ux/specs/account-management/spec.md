## ADDED Requirements

### Requirement: Provide dedicated account management module
The system SHALL provide a dedicated account management module for account listing, creation, renaming, and deletion.

#### Scenario: User opens account management module
- **WHEN** the user opens the account management module
- **THEN** account listing, creation, renaming, deletion, and deletion confirmation controls are available there instead of on the dashboard home page

### Requirement: Keep accounts available to dashboard and import workflows
The system SHALL make accounts available as selectors in dashboard and import workflows without exposing account CRUD controls on those workflow screens.

#### Scenario: User filters dashboard by account
- **WHEN** the user views dashboard filters
- **THEN** available accounts can be selected for filtering without showing account creation, rename, or delete controls

#### Scenario: User selects import account
- **WHEN** the user prepares an import
- **THEN** available accounts can be selected for import association without showing account creation, rename, or delete controls in the import workflow
