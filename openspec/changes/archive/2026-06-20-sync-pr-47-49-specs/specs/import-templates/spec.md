## ADDED Requirements

### Requirement: Configure split debit and credit columns
The system SHALL allow import templates to store optional debit and credit source columns used by split amount and split direction transforms.

#### Scenario: Split columns configured
- **WHEN** the user configures debit and credit source columns for a template
- **THEN** the system stores those columns with split amount and split direction mappings

### Requirement: Preserve split transform settings when editing templates
The system SHALL preserve split debit and credit column settings when users edit existing templates.

#### Scenario: Split template loaded for editing
- **WHEN** the user edits a template that uses split amount or split direction transforms
- **THEN** the template editor preloads the saved debit and credit source columns

## MODIFIED Requirements

### Requirement: Validate template configuration
The system SHALL validate import templates before saving or applying them, including required split debit and credit columns when split transforms are selected.

#### Scenario: Missing required mapping
- **WHEN** the user attempts to save or apply a template without required transaction mappings
- **THEN** the system rejects the template and identifies the missing required fields

#### Scenario: Missing split columns
- **WHEN** the user attempts to save or apply a template using split transforms without debit and credit source columns
- **THEN** the system rejects the template and identifies the missing split columns
