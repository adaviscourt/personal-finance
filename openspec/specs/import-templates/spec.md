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
The system SHALL validate import templates before saving or applying them.

#### Scenario: Missing required mapping
- **WHEN** the user attempts to save or apply a template without required transaction mappings
- **THEN** the system rejects the template and identifies the missing required fields

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
