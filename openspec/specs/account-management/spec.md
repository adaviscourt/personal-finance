## Purpose

Defines dedicated account listing, creation, renaming, deletion, and workflow selector behavior.

## Requirements

### Requirement: Provide dedicated account management module
The system SHALL provide a dedicated account management module for account listing, creation, renaming, and deletion.

#### Scenario: User opens account management module
- **WHEN** the user opens the account management module
- **THEN** account listing, creation, renaming, deletion, and deletion confirmation controls are available there instead of on the dashboard home page

### Requirement: List accounts
The system SHALL allow users to view available accounts for account management and workflow selection.

#### Scenario: Accounts listed
- **WHEN** the user opens account management or an account selector
- **THEN** the system returns accounts with id, name, institution, account type, created time, and transaction count

### Requirement: Create account
The system SHALL allow users to create an account with a unique non-empty name.

#### Scenario: Account created
- **WHEN** the user provides a valid unused account name
- **THEN** the system creates the account and makes it available for import, template, and dashboard selection

#### Scenario: Duplicate account name rejected
- **WHEN** the user attempts to create an account using an existing account name
- **THEN** the system rejects the request and preserves the existing accounts

### Requirement: Rename account
The system SHALL allow users to edit only an account's name.

#### Scenario: Account renamed
- **WHEN** the user provides a valid unused name for an existing account
- **THEN** the system updates the account name without changing institution, account type, transactions, uploads, or templates

#### Scenario: Missing account cannot be renamed
- **WHEN** the user attempts to rename an account that does not exist
- **THEN** the system rejects the request with a not found response

### Requirement: Delete account
The system SHALL allow users to delete accounts and MUST require explicit confirmation when the account has transactions.

#### Scenario: Account without transactions deleted
- **WHEN** the user deletes an account that has no transactions
- **THEN** the system removes the account and prevents it from appearing in account selectors

#### Scenario: Account with transactions warns before deletion
- **WHEN** the user requests deletion for an account that has one or more transactions without confirmation
- **THEN** the system rejects the deletion and returns the transaction count requiring confirmation

#### Scenario: Confirmed account with transactions deleted
- **WHEN** the user confirms deletion for an account that has transactions
- **THEN** the system deletes the account and handles related account-scoped data without leaving invalid references

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

### Requirement: Support account-scoped workflow data
The system SHALL use selected accounts to scope imports, templates, labels, label rules, and dashboard filters where those workflows require account context.

#### Scenario: Account selected for import workflow
- **WHEN** the user selects an account for import
- **THEN** uploads, duplicate detection, imported transactions, and available templates use that account context

#### Scenario: Account-scoped label used
- **WHEN** the user creates or selects an account-scoped label
- **THEN** rules and dashboard displays preserve that label's account context
