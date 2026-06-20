## Purpose

Defines structured transaction transform behavior for import templates.

## Requirements

### Requirement: Apply structured transform steps
The system SHALL apply transaction transforms from structured template configuration using only supported transform types.

#### Scenario: Supported transform applied
- **WHEN** a template references a supported transform type
- **THEN** the system applies that transform to produce the target transaction field

#### Scenario: Unsupported transform rejected
- **WHEN** a template references an unsupported transform type
- **THEN** the system rejects the template application and reports the unsupported transform

### Requirement: Derive direction from signed amount
The system SHALL support deriving transaction direction from the sign of a numeric source amount.

#### Scenario: Positive amount maps to credit
- **WHEN** a signed amount direction transform is configured with positive amounts as credit
- **THEN** rows with positive source amounts produce `credit` direction

#### Scenario: Negative amount maps to debit
- **WHEN** a signed amount direction transform is configured with negative amounts as debit
- **THEN** rows with negative source amounts produce `debit` direction

### Requirement: Derive direction from split debit and credit columns
The system SHALL support deriving transaction direction from separate debit and credit source columns, treating exactly one populated split column as the transaction direction.

#### Scenario: Credit column has value
- **WHEN** a split amount direction transform is applied to a row with a credit column value and an empty debit column
- **THEN** the transformed transaction direction is `credit`

#### Scenario: Debit column has value
- **WHEN** a split amount direction transform is applied to a row with a debit column value and an empty credit column
- **THEN** the transformed transaction direction is `debit`

### Requirement: Derive amount from split debit and credit columns
The system SHALL support deriving transaction amount from separate debit and credit source columns, treating exactly one populated split column as the transaction amount source.

#### Scenario: Credit amount column has value
- **WHEN** a split amount transform is applied to a row with a credit column value and an empty debit column
- **THEN** the transformed transaction amount is the absolute credit value

#### Scenario: Debit amount column has value
- **WHEN** a split amount transform is applied to a row with a debit column value and an empty credit column
- **THEN** the transformed transaction amount is the absolute debit value

### Requirement: Derive direction from source value lookup
The system SHALL allow a user to map unique source column values to `debit` or `credit` direction values.

#### Scenario: Unique source values mapped
- **WHEN** the user maps each unique value from a selected source column to `debit` or `credit`
- **THEN** the system saves the lookup rules as part of the template

#### Scenario: Lookup value applied
- **WHEN** a row contains a source value configured in the lookup rules
- **THEN** the transformed transaction direction matches the configured lookup result

### Requirement: Preview transformed rows
The system SHALL generate a transformed preview from the uploaded CSV and selected template before final import.

#### Scenario: Transformed preview generated
- **WHEN** the user applies a valid template to an uploaded CSV
- **THEN** the system returns preview rows using the unified transaction fields

### Requirement: Validate split debit and credit columns
The system SHALL reject split debit and credit transforms when a row cannot produce one unambiguous amount and direction.

#### Scenario: Both split columns empty
- **WHEN** a split amount transform is applied to a row where both debit and credit columns are empty or dash placeholders
- **THEN** the system rejects the row with a prepare error

#### Scenario: Both split columns populated
- **WHEN** a split amount transform is applied to a row where both debit and credit columns contain values
- **THEN** the system rejects the row with a prepare error

### Requirement: Treat dash placeholders as empty split values
The system SHALL treat dash placeholders in split debit or credit source columns as empty values.

#### Scenario: Debit dash and credit amount
- **WHEN** a row has a dash placeholder in the debit column and a value in the credit column
- **THEN** split transforms produce a credit transaction using the credit amount

#### Scenario: Credit dash and debit amount
- **WHEN** a row has a dash placeholder in the credit column and a value in the debit column
- **THEN** split transforms produce a debit transaction using the debit amount
