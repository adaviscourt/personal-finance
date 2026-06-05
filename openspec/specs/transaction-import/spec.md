## Purpose

Defines confirmed transaction import behavior and source context retention.

## Requirements

### Requirement: Confirm normalized transaction import
The system SHALL import normalized transactions only after the user confirms the transformed preview.

#### Scenario: User confirms import
- **WHEN** the user confirms a valid transformed preview
- **THEN** the system persists the normalized transactions to the transactions table

#### Scenario: User does not confirm import
- **WHEN** the user previews transformed rows but does not confirm the import
- **THEN** the system does not create transactions from those rows

### Requirement: Store raw import rows
The system SHALL store raw parsed row data for uploaded CSV imports.

#### Scenario: Raw rows stored with upload
- **WHEN** the system accepts a CSV for import preparation
- **THEN** the parsed raw rows are associated with the upload record

### Requirement: Link transactions to source import context
The system SHALL retain source context for imported transactions.

#### Scenario: Transaction linked to upload and raw row
- **WHEN** a normalized transaction is created from an uploaded CSV row
- **THEN** the transaction references its upload and source raw row

### Requirement: Persist unified transaction fields
The system SHALL persist normalized transactions with the MVP unified transaction fields.

#### Scenario: Transaction fields persisted
- **WHEN** a transaction row is imported
- **THEN** the system stores date, description, amount, direction, account, source metadata, optional balance, optional check number, and optional label

### Requirement: Detect likely duplicate transactions
The system SHALL detect likely duplicate transactions during import using normalized transaction attributes.

#### Scenario: Duplicate candidate found
- **WHEN** an import contains a row matching an existing transaction by account, date, normalized description, amount, and direction
- **THEN** the system identifies the row as a likely duplicate before final insertion

### Requirement: Select active account for import
The system SHALL require users to select an existing active account when preparing a transaction import.

#### Scenario: Active account selected for import
- **WHEN** the user prepares an import with a selected account
- **THEN** the system associates the upload, duplicate detection, and imported transactions with that account

#### Scenario: Missing import account rejected
- **WHEN** the user attempts to prepare an import without selecting an existing account
- **THEN** the system rejects the import preparation and does not store uploaded rows
