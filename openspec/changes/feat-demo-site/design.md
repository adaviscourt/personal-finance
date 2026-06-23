## Context

The current app is a personal finance tracker with a React frontend, FastAPI backend, SQLite persistence, account-scoped imports, labels, upload ledger, and dashboard review. Existing production deployment targets a single container image, while issue #61 asks for a public demo deployable through Vercel on a subdomain.

The demo must stay close to the real app. A copy or fork of app code would drift quickly, so the design uses demo configuration, seeded public data, and small guards around unsafe public actions while preserving the same routes, components, API shapes, and dashboard/import flows where possible.

## Goals / Non-Goals

**Goals:**
- Provide a Vercel-ready public demo mode from the same repo and app code path.
- Seed realistic sample accounts, labels, transactions, upload history, and optional sample import files for a young single US user earning about $100k in a MCOL city.
- Prevent public visitors from uploading private files, while still allowing a safe sample-file import experience if implementation supports it.
- Make demo behavior deterministic enough for tests and repeatable public deployments.
- Preserve normal self-hosted/local app behavior when demo mode is not enabled.

**Non-Goals:**
- Multi-user auth, public account creation, or visitor-specific persistence.
- Full production hardening for arbitrary public write traffic beyond demo-safe guards.
- Replacing the existing container/Unraid deployment path.
- Creating a separate demo-only frontend or backend copy.

## Decisions

### Use configuration-gated demo mode

Demo behavior should be enabled by an explicit environment/configuration flag rather than by route name, branch, or copied entrypoint. This lets Vercel set demo mode while local and container deployments keep existing behavior.

Alternatives considered:
- Separate demo branch: rejected because it would drift from app code.
- Separate demo app copy: rejected because it violates parity requirement.
- Route-only detection: rejected because backend-side import and seed protections also need to know demo state.

### Seed deterministic public demo data

Demo mode should initialize or expose deterministic sample data: checking, savings, and credit card accounts; salary income near $100k annualized; rent, groceries, utilities, transit, insurance, fitness, subscriptions, dining, events, travel savings/spend, and hobby purchases; labels with controllability metadata; and enough history for dashboard filters/trends.

Alternatives considered:
- Static frontend-only mock data: rejected because it bypasses backend/API parity.
- Random generated data on each deploy: rejected because tests, screenshots, and demos become inconsistent.

### Prefer sample-file import over arbitrary upload in demo

The safest implementation is to disable raw visitor file selection in demo mode and provide curated bundled sample files that drive the same parsing, mapping, preview, duplicate warning, and confirmation screens. If sample import is too large for first implementation, demo mode may disable import creation while keeping upload history visible.

Alternatives considered:
- Allow arbitrary uploads but discard data: rejected because users may still provide private financial files to a public demo.
- Hide import entirely: acceptable fallback only if sample-file flow is not built, but less representative.

### Keep Vercel deployment lightweight

Vercel configuration should point at the same repo and deploy a demo-compatible build without requiring a fork. Any serverless/runtime constraints should be handled through existing app architecture where feasible, plus documented environment variables and subdomain setup.

Alternatives considered:
- Deploy only static frontend on Vercel with remote API elsewhere: rejected unless implementation discovers Vercel cannot run required backend behavior, because it increases operational complexity.
- Use existing container only: rejected because acceptance criteria explicitly requires Vercel project connection.

## Risks / Trade-offs

- Vercel runtime may not match the current FastAPI/container serving model -> validate deployment constraints early and document any required adapter or API hosting decision.
- Public demo writes could mutate shared data and make demos confusing -> reset demo data on startup/deploy or block non-sample destructive writes in demo mode.
- Sample data could look unrealistic or too personal -> use synthetic merchants, round salary assumptions, and generic labels only.
- Demo-only branches in UI can grow over time -> isolate demo decisions in config/state adapters and keep component/API contracts unchanged.
- Disabling imports is safer but weaker for product demonstration -> tasks should prefer sample-file import when feasible and document fallback if not.

## Migration Plan

No user data migration is required. Implementation should add demo configuration and seed data without changing existing production defaults.

Deployment steps:
- Add Vercel project configuration and required demo environment variables.
- Deploy preview from the feature branch and verify the public subdomain loads seeded demo data.
- Confirm local/container deployments continue using normal import and persistence behavior when demo mode is disabled.

Rollback strategy:
- Disable the Vercel project or remove the demo-mode environment flag.
- Revert demo configuration and seed artifacts without touching existing production data paths.

## Open Questions

- Can the current FastAPI backend run acceptably in Vercel for demo purposes, or is a small deployment adapter needed?
- Should demo writes reset per deployment, per session, or be read-only except for sample import flow?
- Which existing subdomain will point at the Vercel project?
