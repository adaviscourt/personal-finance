## ADDED Requirements

### Requirement: Create custom labels
The system SHALL allow users to create custom labels with a name, optional account scope, and controllable or non-controllable classification.

#### Scenario: Custom label created
- **WHEN** the user provides a valid label name, scope, and controllability value
- **THEN** the system creates the label and makes it available for rules, dashboard filters, and label displays

#### Scenario: Duplicate label rejected
- **WHEN** the user creates a label with the same name, scope, and controllability as an existing label
- **THEN** the system rejects the duplicate label

#### Scenario: Same label name with different controllability
- **WHEN** the user creates a label with the same name and scope but different controllability
- **THEN** the system allows the distinct label

### Requirement: Scope labels and rules by account
The system SHALL support global labels, account-scoped labels, and rules that inherit account scope from the selected label.

#### Scenario: Account-scoped label selected for rule
- **WHEN** the user creates a rule for an account-scoped label
- **THEN** the rule applies only to transactions from that label's account

#### Scenario: Global label selected for rule
- **WHEN** the user creates a rule for a global label
- **THEN** the rule can apply to transactions from any account

### Requirement: Match labels by description contains or regex
The system SHALL allow label rules to match transaction descriptions using contains or regex matching.

#### Scenario: Contains rule created
- **WHEN** the user creates a description contains rule
- **THEN** matching transaction descriptions receive the selected label

#### Scenario: Regex rule created
- **WHEN** the user creates a valid description regex rule
- **THEN** transaction descriptions matching the regex receive the selected label

#### Scenario: Invalid regex rejected
- **WHEN** the user previews or saves an invalid regex rule
- **THEN** the system rejects the regex and reports the validation error

### Requirement: Preview label rule matches
The system SHALL provide a debounced match preview for label rules and limit returned preview rows.

#### Scenario: Rule preview requested
- **WHEN** the user enters a label rule pattern
- **THEN** the system shows the number of matching transactions and a limited sample of matching rows

### Requirement: Edit label rules
The system SHALL allow users to edit existing label rules and reapply the updated rule to matching transactions.

#### Scenario: Rule edited
- **WHEN** the user changes an existing rule's match type, pattern, or label
- **THEN** the system clears labels applied by the prior rule definition and applies the updated rule to current matching transactions

### Requirement: Delete label rules
The system SHALL allow users to delete existing label rules and clear labels applied by the deleted rule.

#### Scenario: Rule deleted
- **WHEN** the user deletes a label rule
- **THEN** the system removes the rule and clears labels that were applied by that rule

### Requirement: Display grouped labels with controllability
The system SHALL display labels grouped or styled by account scope and controllability metadata where labels are listed or selected.

#### Scenario: Labels displayed
- **WHEN** the labeling interface lists labels
- **THEN** the user can distinguish global labels, account-scoped labels, controllable labels, and non-controllable labels

## MODIFIED Requirements

### Requirement: Provide fixed label taxonomy
The system SHALL seed a fixed set of system labels for the MVP and SHALL allow additional custom labels.

#### Scenario: Default labels available
- **WHEN** the user labels transactions
- **THEN** the system offers the predefined system labels with controllability metadata

#### Scenario: Custom labels available
- **WHEN** the user creates custom labels
- **THEN** the system offers those labels alongside system labels in rule and dashboard controls

## REMOVED Requirements

### Requirement: Prevent custom labels
**Reason**: Custom labels with account scope and controllability are now required for shipped labeling workflows.
**Migration**: Use `Create custom labels` and `Scope labels and rules by account` requirements instead.
