## ADDED Requirements

### Requirement: Compose description from ordered source columns
The system SHALL support deriving the Description field by concatenating multiple source column values in a saved order, separated by a single space.

#### Scenario: Multiple description parts populated
- **WHEN** a description composition uses `Description` followed by `Check No` and both source values are populated
- **THEN** the transformed Description is the trimmed `Description` value, one space, and the trimmed `Check No` value

#### Scenario: Empty description part skipped
- **WHEN** a description composition includes a source column whose row value is empty
- **THEN** the transformed Description omits the empty value and does not add an extra separator

#### Scenario: Description parts reordered
- **WHEN** a user reorders the source columns used for Description
- **THEN** transformed rows concatenate Description parts in the updated order

### Requirement: Derive amount and direction from split debit and credit amount mode
The system SHALL support deriving both amount and direction from one split debit/credit amount configuration.

#### Scenario: Debit column has value
- **WHEN** split debit/credit amount mode is applied to a row with a debit column value and an empty credit column
- **THEN** the transformed amount is the absolute debit value and the transformed direction is `debit`

#### Scenario: Credit column has value
- **WHEN** split debit/credit amount mode is applied to a row with a credit column value and an empty debit column
- **THEN** the transformed amount is the absolute credit value and the transformed direction is `credit`

## MODIFIED Requirements

### Requirement: Validate split debit and credit columns
The system SHALL reject split debit and credit transforms or split debit/credit amount mode when a row cannot produce one unambiguous amount and direction.

#### Scenario: Both split columns empty
- **WHEN** split debit/credit amount handling is applied to a row where both debit and credit columns are empty or dash placeholders
- **THEN** the system rejects the row with a prepare error

#### Scenario: Both split columns populated
- **WHEN** split debit/credit amount handling is applied to a row where both debit and credit columns contain values
- **THEN** the system rejects the row with a prepare error

### Requirement: Treat dash placeholders as empty split values
The system SHALL treat dash placeholders in split debit or credit source columns as empty values.

#### Scenario: Debit dash and credit amount
- **WHEN** a row has a dash placeholder in the debit column and a value in the credit column
- **THEN** split debit/credit amount handling produces a credit transaction using the credit amount

#### Scenario: Credit dash and debit amount
- **WHEN** a row has a dash placeholder in the credit column and a value in the debit column
- **THEN** split debit/credit amount handling produces a debit transaction using the debit amount
