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
