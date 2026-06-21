## ADDED Requirements

### Requirement: Present CSV preview as guided step
The system SHALL present CSV upload preview as its own focused step within the guided import flow.

#### Scenario: User previews CSV in source file step
- **WHEN** the user uploads a valid CSV file in the source file step
- **THEN** the system shows detected headers and preview rows before allowing the user to continue to mapping controls

#### Scenario: User returns to source file step
- **WHEN** the user goes back to the source file step after previewing a CSV
- **THEN** the system shows the current selected file preview or clearly indicates that a new file can be selected

#### Scenario: User changes CSV file
- **WHEN** the user selects a different CSV file after preparing later import state
- **THEN** the system clears downstream mapping preview, transformed preview, duplicate warning, and confirmation state tied to the prior file
