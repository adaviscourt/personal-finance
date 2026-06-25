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
