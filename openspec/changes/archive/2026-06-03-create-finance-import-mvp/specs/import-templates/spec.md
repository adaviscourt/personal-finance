## ADDED Requirements

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

### Requirement: Associate template with account optionally
The system SHALL support templates that are globally reusable and MAY be associated with an account for convenience.

#### Scenario: Global template reused
- **WHEN** the user selects a template that is not tied to a specific account
- **THEN** the system allows the template to be applied to the uploaded CSV
