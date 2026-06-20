## ADDED Requirements

### Requirement: Build production container image
The system SHALL provide a production container image that builds the React frontend and serves the frontend and FastAPI backend from one process on port 8000.

#### Scenario: Container serves app
- **WHEN** the production container starts successfully
- **THEN** the web UI and API are available from port 8000

#### Scenario: Frontend assets built into backend image
- **WHEN** the container image is built
- **THEN** the frontend production build is copied into the backend static asset directory

### Requirement: Persist container database under data volume
The system SHALL default production SQLite storage to `/data/personal_finance.db` so data survives container restarts and upgrades when `/data` is mounted.

#### Scenario: Data volume mounted
- **WHEN** the container runs with a host path mounted at `/data`
- **THEN** the SQLite database is created and reused under that mounted path

### Requirement: Publish release images to GHCR
The system SHALL publish container images to GitHub Container Registry when a GitHub release is published.

#### Scenario: Release published
- **WHEN** a GitHub release is published
- **THEN** the release workflow builds, tags, pushes, and attests the container image in GHCR

### Requirement: Provide Unraid installation template
The system SHALL provide an Unraid XML template that configures the GHCR image, web port, persistent app data path, and database URL.

#### Scenario: Unraid template installed
- **WHEN** a user installs the app from the Unraid template
- **THEN** Unraid configures port 8000, maps host appdata to `/data`, and sets `DATABASE_URL` under `/data`
