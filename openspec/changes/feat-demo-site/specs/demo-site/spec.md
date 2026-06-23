## ADDED Requirements

### Requirement: Enable public demo mode
The system SHALL provide an explicit demo mode that can be enabled by deployment configuration without using a separate fork or copied application implementation.

#### Scenario: Demo mode enabled by configuration
- **WHEN** the application starts with demo mode enabled
- **THEN** the frontend and backend use the normal application routes, components, and API contracts with demo-specific data and safety guards applied by configuration

#### Scenario: Demo mode disabled
- **WHEN** the application starts without demo mode enabled
- **THEN** normal local, container, and self-hosted behavior remains available without demo seed data or public-demo restrictions

### Requirement: Seed realistic demo finance data
The system SHALL provide deterministic synthetic demo accounts, labels, transactions, and source metadata representing a young single person in the USA earning about $100k in a MCOL city, frugal but still spending on social activities, fitness, travel, and hobbies.

#### Scenario: Demo data initialized
- **WHEN** demo mode initializes an empty demo datastore
- **THEN** the datastore contains checking, savings, and credit card accounts; salary income near a $100k annual pace; recurring rent, utilities, groceries, insurance, transit, subscriptions, fitness, dining, events, travel, and hobby transactions; and labels with controllability metadata

#### Scenario: Demo data supports dashboard exploration
- **WHEN** a visitor opens the demo dashboard
- **THEN** the seeded transactions cover enough recent months, labels, accounts, debits, and credits to exercise dashboard filters, KPI cards, spending bars, and trend charts

### Requirement: Protect public demo data entry
The system SHALL prevent public demo visitors from submitting personal financial files or creating private durable data through demo import entry points.

#### Scenario: Visitor attempts personal file upload
- **WHEN** demo mode is enabled and a visitor attempts to provide an arbitrary local file for import
- **THEN** the system prevents the upload and explains that the public demo accepts only bundled sample data or has imports disabled

#### Scenario: Visitor uses safe demo actions
- **WHEN** demo mode exposes sample import or seeded-data reset actions
- **THEN** those actions operate only on bundled synthetic data and do not request or persist visitor-provided financial files

### Requirement: Preserve demo parity with app behavior
The system SHALL keep demo behavior close to the production app by reusing existing application modules and limiting demo-specific logic to configuration, seed data, sample import selection, and public-data protections.

#### Scenario: Demo route renders application modules
- **WHEN** a visitor navigates through demo dashboard, accounts, labels, imports, and upload ledger surfaces
- **THEN** the system presents the same primary application modules used outside demo mode except where demo safety restrictions are required

#### Scenario: Normal code path remains testable
- **WHEN** automated tests run demo and non-demo scenarios
- **THEN** they can verify demo-specific behavior without maintaining a separate copied implementation
*** Add File: /Users/austindaviscourt/Documents/GitHub/personal-finance-worktrees/openspec-issue-61-feat-demo-site/openspec/changes/feat-demo-site/specs/production-deployment/spec.md
## ADDED Requirements

### Requirement: Support Vercel demo deployment
The system SHALL provide configuration and documentation for connecting Vercel to this repository as a new project that deploys the public demo app to a subdomain on an existing site.

#### Scenario: Vercel project configured
- **WHEN** a maintainer creates a new Vercel project from this repository for the demo site
- **THEN** the project can build and run the demo configuration without requiring a fork or copied app code

#### Scenario: Demo subdomain assigned
- **WHEN** a maintainer points an existing-site subdomain at the Vercel project
- **THEN** visitors can load the demo app from that subdomain with demo mode enabled

### Requirement: Keep production deployment behavior unchanged
The system SHALL preserve existing production container and Unraid deployment behavior when demo mode is not enabled.

#### Scenario: Container deployment starts without demo mode
- **WHEN** the production container starts without demo-mode configuration
- **THEN** the app uses the existing production database path, import behavior, and static serving behavior
*** Add File: /Users/austindaviscourt/Documents/GitHub/personal-finance-worktrees/openspec-issue-61-feat-demo-site/openspec/changes/feat-demo-site/specs/transaction-import/spec.md
## ADDED Requirements

### Requirement: Restrict demo import file sources
The system SHALL restrict transaction import file selection in demo mode to either bundled synthetic sample files or no import file selection at all.

#### Scenario: Sample files available in demo mode
- **WHEN** demo mode provides bundled sample files and a visitor starts a new import
- **THEN** the import workflow offers those sample files for selection instead of accepting arbitrary local files

#### Scenario: Sample files unavailable in demo mode
- **WHEN** demo mode does not provide bundled sample files and a visitor starts a new import
- **THEN** the import workflow disables import creation and explains that public demo imports are unavailable to protect private financial data

#### Scenario: Arbitrary file rejected in demo mode
- **WHEN** demo mode is enabled and a visitor attempts to upload a file outside the bundled sample-file path
- **THEN** the system rejects the request before storing raw rows or creating transactions

### Requirement: Emulate import flow with sample data
The system SHALL use the existing guided import flow for bundled demo sample files when sample files are available.

#### Scenario: Visitor imports bundled sample file
- **WHEN** a visitor selects a bundled demo sample file
- **THEN** the system guides the visitor through account selection, CSV preview, template mapping, transformed preview, duplicate warning review, and confirmation using the existing import flow structure

#### Scenario: Sample import confirmed
- **WHEN** a visitor confirms a valid sample-file transformed preview in demo mode
- **THEN** the system creates transactions only from bundled synthetic sample rows and communicates the inserted transaction count
*** Add File: /Users/austindaviscourt/Documents/GitHub/personal-finance-worktrees/openspec-issue-61-feat-demo-site/openspec/changes/feat-demo-site/specs/import-upload-management/spec.md
## ADDED Requirements

### Requirement: Show demo upload history safely
The system SHALL show upload ledger entries for seeded or bundled demo sample files without exposing controls that invite visitors to upload personal files.

#### Scenario: Demo upload ledger viewed
- **WHEN** a visitor opens the import landing page in demo mode
- **THEN** the upload ledger shows seeded or sample upload records with synthetic file names, account context, status, imported transaction count, imported transaction date range, and upload date

#### Scenario: Demo upload action displayed
- **WHEN** demo mode supports bundled sample imports
- **THEN** the upload action starts a sample-file import flow instead of opening arbitrary local file selection

#### Scenario: Demo upload action disabled
- **WHEN** demo mode does not support bundled sample imports
- **THEN** the upload action is disabled or replaced with explanatory copy about public demo import restrictions
*** Add File: /Users/austindaviscourt/Documents/GitHub/personal-finance-worktrees/openspec-issue-61-feat-demo-site/openspec/changes/feat-demo-site/specs/finance-dashboard/spec.md
## ADDED Requirements

### Requirement: Populate dashboard with demo data
The system SHALL populate the dashboard in demo mode with deterministic synthetic transactions and labels that demonstrate realistic personal finance review for a young single US user earning about $100k in a MCOL city.

#### Scenario: Demo dashboard loads
- **WHEN** a visitor opens the dashboard in demo mode
- **THEN** the dashboard shows seeded account filters, label filters, transaction rows, KPI cards, spending bars, and net activity trend data without requiring file upload

#### Scenario: Demo filters exercised
- **WHEN** a visitor changes the demo dashboard month, account filters, or label filters
- **THEN** the dashboard updates using seeded synthetic transactions that include salary income, rent, groceries, utilities, transportation, insurance, subscriptions, dining, entertainment, fitness, travel, savings, and hobby activity

#### Scenario: Demo dashboard has uncategorized examples
- **WHEN** the visitor filters or reviews demo transactions by label
- **THEN** at least some seeded transactions demonstrate uncategorized or relabeling opportunities without containing real personal data
