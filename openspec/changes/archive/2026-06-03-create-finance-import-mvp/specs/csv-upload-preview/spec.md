## ADDED Requirements

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
