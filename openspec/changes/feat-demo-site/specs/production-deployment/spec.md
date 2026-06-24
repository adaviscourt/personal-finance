## ADDED Requirements

### Requirement: Support Vercel demo deployment
The system SHALL provide configuration and documentation for connecting Vercel to this repository as a new static frontend project that deploys the public demo app to a subdomain on an existing site without a required backend API deployment.

#### Scenario: Vercel project configured
- **WHEN** a maintainer creates a new Vercel project from this repository for the demo site
- **THEN** the project can build and run the demo configuration without requiring a fork, copied app code, or public FastAPI origin

#### Scenario: Demo subdomain assigned
- **WHEN** a maintainer points an existing-site subdomain at the Vercel project
- **THEN** visitors can load the demo app from that subdomain with demo mode enabled

### Requirement: Keep production deployment behavior unchanged
The system SHALL preserve existing production container and Unraid deployment behavior when demo mode is not enabled.

#### Scenario: Container deployment starts without demo mode
- **WHEN** the production container starts without demo-mode configuration
- **THEN** the app uses the existing production database path, import behavior, and static serving behavior
