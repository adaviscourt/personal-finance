## ADDED Requirements

### Requirement: Support account-scoped workflow data
The system SHALL use selected accounts to scope imports, templates, labels, label rules, and dashboard filters where those workflows require account context.

#### Scenario: Account selected for import workflow
- **WHEN** the user selects an account for import
- **THEN** uploads, duplicate detection, imported transactions, and available templates use that account context

#### Scenario: Account-scoped label used
- **WHEN** the user creates or selects an account-scoped label
- **THEN** rules and dashboard displays preserve that label's account context

## MODIFIED Requirements

### Requirement: Keep accounts available to dashboard and import workflows
The system SHALL make accounts available as selectors in dashboard and import workflows without exposing account CRUD controls on those workflow screens, and SHALL support multiple selected dashboard accounts.

#### Scenario: User filters dashboard by account
- **WHEN** the user views dashboard filters
- **THEN** available accounts can be selected for filtering without showing account creation, rename, or delete controls

#### Scenario: User filters dashboard by multiple accounts
- **WHEN** the user selects multiple account filters on the dashboard
- **THEN** dashboard tables and summaries include transactions from any selected account

#### Scenario: User selects import account
- **WHEN** the user prepares an import
- **THEN** available accounts can be selected for import association without showing account creation, rename, or delete controls in the import workflow
