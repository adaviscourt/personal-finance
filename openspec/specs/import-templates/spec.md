## Purpose

Defines import template creation, selection, editing, validation, and required account association behavior.

## Requirements

### Requirement: Create import template
The system SHALL allow a user to create an import template that maps source CSV columns to the unified transaction schema.

#### Scenario: Template created with mappings
- **WHEN** the user provides a template name and valid field mappings
- **THEN** the system saves the template for future imports

### Requirement: Select import template during upload
The system SHALL allow a user to select an existing import template while preparing a CSV import.

#### Scenario: Existing template selected
- **WHEN** the user selects an existing template for an uploaded CSV
- **THEN** the system applies that template configuration to generate a transformed preview

### Requirement: Edit import template
The system SHALL allow a user to edit an existing import template's mappings and transform configuration.

#### Scenario: Template edits saved
- **WHEN** the user changes a template mapping or transform setting and saves the template
- **THEN** the system uses the updated template configuration for future template applications

### Requirement: Validate template configuration
The system SHALL validate import templates before saving or applying them, including required split debit and credit columns when split amount mode is selected and required description parts when composed description mapping is selected.

#### Scenario: Missing required mapping
- **WHEN** the user attempts to save or apply a template without required transaction mappings
- **THEN** the system rejects the template and identifies the missing required fields

#### Scenario: Missing split columns
- **WHEN** the user attempts to save or apply a template using split debit/credit amount mode without debit and credit source columns
- **THEN** the system rejects the template and identifies the missing split columns

#### Scenario: Missing description parts
- **WHEN** the user attempts to save or apply a template using composed description mapping without at least one source column
- **THEN** the system rejects the template and identifies the missing description source fields

### Requirement: Associate template with account
The system SHALL require every import template to be associated with an account.

#### Scenario: Account template saved
- **WHEN** the user saves a template after choosing an import account
- **THEN** the system associates the template with that selected account

#### Scenario: Template saved without account
- **WHEN** the user attempts to save a template without an account
- **THEN** the system rejects the template and identifies the missing account

### Requirement: Filter templates by active account
The system SHALL show only templates associated with the active selected account during import workflows.

#### Scenario: Active account templates listed
- **WHEN** the user chooses an active account for imports
- **THEN** the system lists templates associated with that account

#### Scenario: Other account templates hidden
- **WHEN** the user chooses an active account for imports
- **THEN** the system excludes templates associated with other accounts

### Requirement: Configure split debit and credit columns
The system SHALL allow import templates to store debit and credit source columns through a single split debit/credit amount configuration that drives both normalized amount and direction.

#### Scenario: Split columns configured
- **WHEN** the user configures debit and credit source columns for a template
- **THEN** the system stores those columns as one split debit/credit amount configuration

#### Scenario: Split configuration applied
- **WHEN** a saved split debit/credit amount template is applied to a CSV import
- **THEN** the system derives amount and direction from the stored debit and credit source columns

### Requirement: Preserve split transform settings when editing templates
The system SHALL preserve split debit and credit column settings when users edit existing templates, including templates saved with the previous split amount and split amount direction transform configuration.

#### Scenario: Split template loaded for editing
- **WHEN** the user edits a template that uses split debit and credit amount mapping
- **THEN** the template editor preloads the saved debit and credit source columns into the split amount section

#### Scenario: Legacy split transforms loaded for editing
- **WHEN** the user edits a template saved with split amount and split amount direction transforms
- **THEN** the template editor represents those saved debit and credit source columns as split debit/credit amount mode

### Requirement: Configure composed description fields
The system SHALL allow import templates to store an ordered list of source columns used to compose the normalized Description value.

#### Scenario: Description parts configured
- **WHEN** the user selects multiple source columns for Description and orders them
- **THEN** the system stores the selected source columns in that order with the template

#### Scenario: Single description column configured
- **WHEN** the user selects one source column for Description
- **THEN** the system stores a valid single-part description mapping

### Requirement: Preserve composed description settings when editing templates
The system SHALL preserve ordered Description source columns when users edit existing templates.

#### Scenario: Composed description template loaded for editing
- **WHEN** the user edits a template that uses ordered Description source columns
- **THEN** the template editor preloads the same source columns in the saved order
