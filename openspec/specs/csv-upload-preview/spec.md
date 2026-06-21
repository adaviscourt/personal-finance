## Purpose

Defines CSV upload preview behavior for the transaction import workflow.
## Requirements
### Requirement: Upload CSV file for preview
The system SHALL allow a user to upload a CSV statement file and preview the parsed file before importing transactions.

#### Scenario: Successful CSV preview
- **WHEN** the user uploads a valid CSV file
- **THEN** the system returns the detected headers and the first 5 parsed data rows

#### Scenario: CSV has fewer than 5 rows
- **WHEN** the user uploads a valid CSV file with fewer than 5 data rows
- **THEN** the system returns all available parsed data rows

### Requirement: Reject invalid preview files
The system SHALL reject files that cannot be parsed as CSV input for the import workflow.

#### Scenario: Invalid CSV upload
- **WHEN** the user uploads a file that cannot be parsed as CSV
- **THEN** the system reports a preview error and does not create importable transactions

### Requirement: Expose source columns for mapping
The system SHALL expose parsed source column names from the uploaded CSV for template configuration.

#### Scenario: Source columns detected
- **WHEN** the user uploads a valid CSV file with headers
- **THEN** the template configuration flow can use those headers as selectable source columns

### Requirement: Present CSV preview as guided step
The system SHALL present CSV upload preview as its own focused step within the guided import flow.

#### Scenario: User previews CSV in source file step
- **WHEN** the user uploads a valid CSV file in the source file step
- **THEN** the system shows detected headers and preview rows before allowing the user to continue to mapping controls

#### Scenario: User returns to source file step
- **WHEN** the user goes back to the source file step after previewing a CSV
- **THEN** the system shows the current selected file preview or clearly indicates that a new file can be selected

#### Scenario: User changes CSV file
- **WHEN** the user selects a different CSV file after preparing later import state
- **THEN** the system clears downstream mapping preview, transformed preview, duplicate warning, and confirmation state tied to the prior file

