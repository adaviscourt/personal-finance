## MODIFIED Requirements

### Requirement: Associate template with account optionally
The system SHALL support templates that are globally reusable and SHALL allow templates to be associated with the active selected account for convenience.

#### Scenario: Global template reused
- **WHEN** the user selects a template that is not tied to a specific account
- **THEN** the system allows the template to be applied to the uploaded CSV for the active selected account

#### Scenario: Active account template saved
- **WHEN** the user saves a template while an active account is selected
- **THEN** the system can associate the template with that selected account

## ADDED Requirements

### Requirement: Filter templates by active account
The system SHALL show templates that are global or associated with the active selected account during import workflows.

#### Scenario: Active account templates listed
- **WHEN** the user chooses an active account for imports
- **THEN** the system lists global templates and templates associated with that account

#### Scenario: Other account templates hidden
- **WHEN** the user chooses an active account for imports
- **THEN** the system excludes templates associated only with other accounts
