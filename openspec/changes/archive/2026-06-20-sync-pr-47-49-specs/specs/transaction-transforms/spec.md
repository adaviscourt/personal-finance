## ADDED Requirements

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

## MODIFIED Requirements

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
