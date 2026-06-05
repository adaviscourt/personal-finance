## ADDED Requirements

### Requirement: Select active account for import
The system SHALL require users to select an existing active account when preparing a transaction import.

#### Scenario: Active account selected for import
- **WHEN** the user prepares an import with a selected account
- **THEN** the system associates the upload, duplicate detection, and imported transactions with that account

#### Scenario: Missing import account rejected
- **WHEN** the user attempts to prepare an import without selecting an existing account
- **THEN** the system rejects the import preparation and does not store uploaded rows
