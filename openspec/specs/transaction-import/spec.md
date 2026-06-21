## Purpose

Defines dedicated transaction import workflow behavior, confirmed imports, and source context retention.
## Requirements
### Requirement: Provide dedicated import module
The system SHALL provide a dedicated import module with an upload ledger entry page and a separate guided flow for CSV upload, template selection or editing, transformed preview, duplicate warning review, and import confirmation.

#### Scenario: User opens import module
- **WHEN** the user opens the import module
- **THEN** the import landing page shows prior file uploads and a clear action to start a new upload instead of showing the full import flow on the dashboard home page

#### Scenario: User starts import flow
- **WHEN** the user starts a new upload from the import landing page
- **THEN** CSV upload, import template, transformed preview, duplicate warning, and confirmation controls are available in the guided import flow

### Requirement: Guide import workflow steps
The system SHALL present import actions as separate progressive screens from account selection to confirmed import, including prescriptive template mapping controls for common CSV layouts, a step progress tracker, and back navigation for each step after the first.

#### Scenario: User starts an import
- **WHEN** the user starts an import workflow
- **THEN** the interface presents the flow as choosing an account, selecting a CSV, reviewing CSV preview, choosing or editing account-scoped template mappings, preparing a transformed preview, reviewing warnings, and confirming import

#### Scenario: Step progress shown
- **WHEN** the user is in the guided import flow
- **THEN** the system shows a progress tracker that identifies the current step, completed steps, and unavailable future steps

#### Scenario: User goes back one step
- **WHEN** the user activates a back action from a step after account selection
- **THEN** the system returns to the previous import step without discarding valid inputs from earlier steps

#### Scenario: No accounts exist
- **WHEN** the user opens the import module before any account exists
- **THEN** the import module provides a path to the accounts module before CSV upload or template selection

#### Scenario: User selects an import account
- **WHEN** the user chooses an account at the start of import
- **THEN** the template selector shows templates tied to that account

#### Scenario: Required import inputs missing
- **WHEN** the user attempts to prepare or confirm an import without required inputs
- **THEN** the import module shows contextual validation for the missing file, account, or mapping information

#### Scenario: Split debit and credit mapping configured
- **WHEN** the user indicates that amount values are split across separate debit and credit CSV columns
- **THEN** the import mapping interface asks for debit and credit source columns in one dedicated split amount section instead of requiring separate amount and direction transform coordination

#### Scenario: Description composition configured
- **WHEN** the user configures Description from multiple source fields
- **THEN** the import mapping interface allows the fields to be ordered before the transformed preview is prepared

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
The system SHALL persist normalized transactions with the MVP unified transaction fields derived from template mappings and transforms.

#### Scenario: Transaction fields persisted
- **WHEN** a transaction row is imported
- **THEN** the system stores date, description, amount, direction, account, source metadata, optional balance, optional check number, optional label, and source rule provenance when a rule applied the label

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

### Requirement: Link import completion back to dashboard review
The system SHALL provide a clear path from a completed import to dashboard transaction review.

#### Scenario: Import completes
- **WHEN** the user confirms an import successfully
- **THEN** the import module communicates the inserted transaction count and provides a way to review the imported month in the dashboard

### Requirement: Gate confirmation on transformed preview
The system SHALL expose import confirmation only after a transformed preview has been prepared successfully.

#### Scenario: Preview not prepared
- **WHEN** the user has not prepared transformed rows
- **THEN** the import module does not allow import confirmation

#### Scenario: Preview prepared
- **WHEN** the user prepares transformed rows successfully
- **THEN** the import module allows review of warnings and import confirmation

### Requirement: Show prepare errors visibly
The system SHALL show contextual prepare errors when import preparation fails because required inputs, mappings, or transform data are invalid.

#### Scenario: Prepare fails
- **WHEN** import preparation fails validation
- **THEN** the import module displays the validation error near the import workflow and does not persist transactions

### Requirement: Keep import flow visually focused
The system SHALL show only the active import step's primary controls during the guided flow.

#### Scenario: User advances through import
- **WHEN** the user moves from one import step to the next
- **THEN** the next step replaces the prior step as the primary content instead of appending below all prior steps

