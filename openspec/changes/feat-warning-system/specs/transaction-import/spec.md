## ADDED Requirements

### Requirement: Preselect import account from warning action
The system SHALL let dashboard stale-data warning actions open the import workflow with the affected account preselected.

#### Scenario: User follows stale warning action
- **WHEN** the user activates the import action beside a stale-data dashboard warning
- **THEN** the system opens the import workflow with the warning's affected account selected

#### Scenario: Preselected account loads import context
- **WHEN** the import workflow opens with an account preselected from a warning action
- **THEN** the import workflow loads account-scoped import context for that account before upload preparation

#### Scenario: Account unavailable when action is followed
- **WHEN** the user follows a warning action for an account that is no longer available for import
- **THEN** the import workflow does not select an invalid account and communicates that the account is unavailable
