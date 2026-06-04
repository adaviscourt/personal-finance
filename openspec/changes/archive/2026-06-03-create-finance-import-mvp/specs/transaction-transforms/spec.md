## ADDED Requirements

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
The system SHALL support deriving transaction direction from separate debit and credit source columns.

#### Scenario: Credit column has value
- **WHEN** a split amount direction transform is applied to a row with a credit column value
- **THEN** the transformed transaction direction is `credit`

#### Scenario: Debit column has value
- **WHEN** a split amount direction transform is applied to a row with a debit column value
- **THEN** the transformed transaction direction is `debit`

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
