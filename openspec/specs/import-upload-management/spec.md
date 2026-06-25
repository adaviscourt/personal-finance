# import-upload-management Specification

## Purpose
TBD - created by archiving change track-import-file-uploads. Update Purpose after archive.
## Requirements
### Requirement: List file upload summaries
The system SHALL provide a file upload ledger for transaction imports.

#### Scenario: User views import landing page
- **WHEN** the user opens the import module landing page
- **THEN** the system shows a table of upload records with file name, account, status, imported transaction count, imported transaction date range, and upload date

#### Scenario: Upload has imported transactions
- **WHEN** an upload has confirmed imported transactions
- **THEN** the ledger shows the count of linked transactions and the minimum and maximum linked transaction dates

#### Scenario: Upload has no imported transactions
- **WHEN** an upload has no linked imported transactions
- **THEN** the ledger shows zero imported transactions and no imported transaction date range

### Requirement: Delete transactions by upload
The system SHALL allow a user to remove all transactions associated with a file upload.

#### Scenario: User deletes imported upload transactions
- **WHEN** the user confirms deletion for an upload that has imported transactions
- **THEN** the system deletes every transaction linked to that upload and reports the deleted transaction count

#### Scenario: Deleted upload remains auditable
- **WHEN** upload transactions are deleted
- **THEN** the upload record and raw import rows remain available as source history with a removed status

#### Scenario: Missing upload delete rejected
- **WHEN** the user attempts to delete transactions for an upload that does not exist
- **THEN** the system reports that the upload was not found and does not delete transactions

### Requirement: Provide upload entry point
The system SHALL provide a clear action from the upload ledger to start a new transaction import.

#### Scenario: User starts new upload
- **WHEN** the user activates the upload action from the import landing page
- **THEN** the system opens the guided import flow without appending the flow below the upload ledger

#### Scenario: No uploads exist
- **WHEN** the user opens the import landing page before any uploads exist
- **THEN** the system shows an empty state explaining that imported files will appear there and provides the upload action

### Requirement: Show demo upload history safely
The system SHALL show upload ledger entries for seeded or bundled demo sample files without exposing controls that invite visitors to upload personal files.

#### Scenario: Demo upload ledger viewed
- **WHEN** a visitor opens the import landing page in demo mode
- **THEN** the upload ledger shows seeded or sample upload records with synthetic file names, account context, status, imported transaction count, imported transaction date range, and upload date

#### Scenario: Demo upload action displayed
- **WHEN** demo mode supports bundled sample imports
- **THEN** the upload action starts a sample-file import flow instead of opening arbitrary local file selection

#### Scenario: Demo upload action disabled
- **WHEN** demo mode does not support bundled sample imports
- **THEN** the upload action is disabled or replaced with explanatory copy about public demo import restrictions

