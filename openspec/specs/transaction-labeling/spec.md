## Purpose

Defines dedicated transaction labeling workflow, MVP taxonomy, and reusable label matching rules.

## Requirements

### Requirement: Provide dedicated labeling module
The system SHALL provide a dedicated labeling module for transaction label rule management.

#### Scenario: User opens labeling module
- **WHEN** the user opens the labeling module
- **THEN** label rule creation and existing label rule review are available there instead of on the dashboard home page

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

### Requirement: Keep labels available to dashboard filters
The system SHALL make the fixed label taxonomy available for dashboard label filtering.

#### Scenario: User views dashboard label filter
- **WHEN** the dashboard loads labels successfully
- **THEN** the dashboard offers the fixed labels and an all-labels default for filtering transactions

#### Scenario: User filters by label after rule changes
- **WHEN** the user creates a label rule and returns to the dashboard
- **THEN** matching transactions can be reviewed through the dashboard label filter
