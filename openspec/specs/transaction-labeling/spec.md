## Purpose

Defines MVP transaction labeling taxonomy and reusable label matching rules.

## Requirements

### Requirement: Provide fixed label taxonomy
The system SHALL provide a fixed set of transaction labels for the MVP.

#### Scenario: Default labels available
- **WHEN** the user labels transactions
- **THEN** the system offers only the predefined labels

### Requirement: Prevent custom labels
The system SHALL NOT allow users to create custom labels in the MVP.

#### Scenario: Custom label creation unavailable
- **WHEN** the user interacts with transaction labeling controls
- **THEN** the system does not provide a custom label creation action

### Requirement: Label matching transactions manually
The system SHALL allow a user to assign a predefined label to transactions matched by merchant or description text.

#### Scenario: Description pattern labeled
- **WHEN** the user creates a description match rule and selects a predefined label
- **THEN** the system applies that label to matching transactions

### Requirement: Save reusable label rules
The system SHALL save merchant or description label rules for future transaction matching.

#### Scenario: Rule applies to future imports
- **WHEN** new transactions are imported after a label rule has been saved
- **THEN** matching imported transactions receive the rule's predefined label

### Requirement: Keep unmatched transactions uncategorized
The system SHALL treat transactions without a matching label rule or manual label as uncategorized.

#### Scenario: No matching label
- **WHEN** a transaction has no assigned label and matches no label rule
- **THEN** the transaction appears as uncategorized in label-based views
