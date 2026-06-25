## ADDED Requirements

### Requirement: Enable public demo mode
The system SHALL provide an explicit demo mode that can be enabled by deployment configuration without using a separate fork or copied application implementation.

#### Scenario: Demo mode enabled by configuration
- **WHEN** the application starts with demo mode enabled
- **THEN** the frontend and backend use the normal application routes, components, and API contracts with demo-specific data and safety guards applied by configuration

#### Scenario: Static demo uses fake backend
- **WHEN** the frontend is built with demo mode enabled for a static public deployment
- **THEN** API client calls resolve from deterministic synthetic in-browser data without requiring a deployed backend API

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
