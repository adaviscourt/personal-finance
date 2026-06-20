## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Guide import workflow steps
The system SHALL present import actions in a progressive guided order from account selection to confirmed import.

#### Scenario: User starts an import
- **WHEN** the user starts an import workflow
- **THEN** the interface presents the flow as choosing an account, selecting a CSV, reviewing CSV preview, choosing or editing account-scoped template mappings, preparing a transformed preview, reviewing warnings, and confirming import

#### Scenario: No accounts exist
- **WHEN** the user opens the import module before any account exists
- **THEN** the import module provides a path to the accounts module before CSV upload or template selection

#### Scenario: User selects an import account
- **WHEN** the user chooses an account at the start of import
- **THEN** the template selector shows templates tied to that account

#### Scenario: Required import inputs missing
- **WHEN** the user attempts to prepare or confirm an import without required inputs
- **THEN** the import module shows contextual validation for the missing file, account, or mapping information

### Requirement: Persist unified transaction fields
The system SHALL persist normalized transactions with the MVP unified transaction fields derived from template mappings and transforms.

#### Scenario: Transaction fields persisted
- **WHEN** a transaction row is imported
- **THEN** the system stores date, description, amount, direction, account, source metadata, optional balance, optional check number, optional label, and source rule provenance when a rule applied the label
