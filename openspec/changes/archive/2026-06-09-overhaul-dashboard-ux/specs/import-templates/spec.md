## MODIFIED Requirements

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
