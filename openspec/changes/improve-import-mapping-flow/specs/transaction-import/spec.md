## MODIFIED Requirements

### Requirement: Guide import workflow steps
The system SHALL present import actions in a progressive guided order from account selection to confirmed import, including prescriptive template mapping controls for common CSV layouts.

#### Scenario: User starts an import
- **WHEN** the user starts an import workflow
- **THEN** the interface presents the flow as choosing an account, selecting a CSV, reviewing CSV preview, choosing or editing account-scoped template mappings, preparing a transformed preview, reviewing warnings, and confirming import

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
