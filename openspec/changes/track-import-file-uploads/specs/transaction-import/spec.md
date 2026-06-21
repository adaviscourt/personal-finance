## MODIFIED Requirements

### Requirement: Provide dedicated import module
The system SHALL provide a dedicated import module with an upload ledger entry page and a separate guided flow for CSV upload, template selection or editing, transformed preview, duplicate warning review, and import confirmation.

#### Scenario: User opens import module
- **WHEN** the user opens the import module
- **THEN** the import landing page shows prior file uploads and a clear action to start a new upload instead of showing the full import flow on the dashboard home page

#### Scenario: User starts import flow
- **WHEN** the user starts a new upload from the import landing page
- **THEN** CSV upload, import template, transformed preview, duplicate warning, and confirmation controls are available in the guided import flow

### Requirement: Guide import workflow steps
The system SHALL present import actions as separate progressive screens from account selection to confirmed import, including prescriptive template mapping controls for common CSV layouts, a step progress tracker, and back navigation for each step after the first.

#### Scenario: User starts an import
- **WHEN** the user starts an import workflow
- **THEN** the interface presents the flow as choosing an account, selecting a CSV, reviewing CSV preview, choosing or editing account-scoped template mappings, preparing a transformed preview, reviewing warnings, and confirming import

#### Scenario: Step progress shown
- **WHEN** the user is in the guided import flow
- **THEN** the system shows a progress tracker that identifies the current step, completed steps, and unavailable future steps

#### Scenario: User goes back one step
- **WHEN** the user activates a back action from a step after account selection
- **THEN** the system returns to the previous import step without discarding valid inputs from earlier steps

#### Scenario: No accounts exist
- **WHEN** the user opens the import module before any account exists
- **THEN** the import module provides a path to the accounts module before CSV upload or template selection

#### Scenario: User selects an import account
- **WHEN** the user chooses an account at the start of import
- **THEN** the template selector shows templates tied to that account

#### Scenario: Required import inputs missing
- **WHEN** the user attempts to prepare or confirm an import without required inputs
- **THEN** the import module shows contextual validation for the missing file, account, or mapping information

#### Scenario: Split debit and credit mapping configured
- **WHEN** the user indicates that amount values are split across separate debit and credit CSV columns
- **THEN** the import mapping interface asks for debit and credit source columns in one dedicated split amount section instead of requiring separate amount and direction transform coordination

#### Scenario: Description composition configured
- **WHEN** the user configures Description from multiple source fields
- **THEN** the import mapping interface allows the fields to be ordered before the transformed preview is prepared

## ADDED Requirements

### Requirement: Keep import flow visually focused
The system SHALL show only the active import step's primary controls during the guided flow.

#### Scenario: User advances through import
- **WHEN** the user moves from one import step to the next
- **THEN** the next step replaces the prior step as the primary content instead of appending below all prior steps
