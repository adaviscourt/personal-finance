## ADDED Requirements

### Requirement: Provide dedicated import module
The system SHALL provide a dedicated import module for CSV upload, template selection or editing, transformed preview, duplicate warning review, and import confirmation.

#### Scenario: User opens import module
- **WHEN** the user opens the import module
- **THEN** CSV upload, import template, transformed preview, duplicate warning, and confirmation controls are available there instead of on the dashboard home page

### Requirement: Guide import workflow steps
The system SHALL present import actions in a guided order from source file to confirmed import.

#### Scenario: User starts an import
- **WHEN** the user starts an import workflow
- **THEN** the interface presents the flow as selecting a CSV, choosing or editing mappings, preparing a transformed preview, reviewing warnings, and confirming import

#### Scenario: Required import inputs missing
- **WHEN** the user attempts to prepare or confirm an import without required inputs
- **THEN** the import module shows contextual validation for the missing file, account, or mapping information

### Requirement: Link import completion back to dashboard review
The system SHALL provide a clear path from a completed import to dashboard transaction review.

#### Scenario: Import completes
- **WHEN** the user confirms an import successfully
- **THEN** the import module communicates the inserted transaction count and provides a way to review the imported month in the dashboard
