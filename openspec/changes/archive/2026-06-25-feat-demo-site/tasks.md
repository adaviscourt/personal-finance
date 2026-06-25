## 1. Demo Runtime And Configuration

- [x] 1.1 Verify the current frontend/backend build can run in Vercel demo deployment, or document the smallest required adapter if FastAPI cannot run directly there.
- [x] 1.2 Add an explicit demo-mode configuration flag available to backend and frontend without changing normal local/container defaults.
- [x] 1.3 Add demo-mode tests proving non-demo deployments keep existing import, persistence, and dashboard behavior.
- [x] 1.4 Add a static frontend fake backend for `VITE_DEMO_MODE=true` so the public demo does not require a deployed API.

## 2. Seeded Demo Data

- [x] 2.1 Create deterministic synthetic demo seed data for checking, savings, and credit card accounts.
- [x] 2.2 Seed salary income near $100k annualized plus realistic MCOL spending across rent, groceries, utilities, transportation, insurance, subscriptions, dining, entertainment, fitness, travel, savings, and hobbies.
- [x] 2.3 Seed labels and label metadata that exercise controllable, non-controllable, account-scoped, global, and uncategorized dashboard states.
- [x] 2.4 Seed source metadata and upload records needed for dashboard and upload-ledger parity.
- [x] 2.5 Add backend tests verifying demo data initializes deterministically and contains no real personal data.

## 3. Safe Demo Import Flow

- [x] 3.1 Decide whether first implementation supports bundled sample-file imports or disables import creation in demo mode, based on implementation complexity discovered during coding.
- [x] 3.2 If sample imports are supported, add bundled synthetic sample CSV files and route selection through the existing guided import flow. (Not applicable: first implementation disables import creation in demo mode.)
- [x] 3.3 If sample imports are not supported, disable demo import creation with clear explanatory copy while keeping upload history visible.
- [x] 3.4 Block arbitrary visitor file upload in demo mode before raw rows or transactions are persisted.
- [x] 3.5 Add backend and frontend tests for sample-file import or disabled-import behavior, including rejection of arbitrary files.

## 4. Demo UI Parity

- [x] 4.1 Wire demo mode into existing dashboard, accounts, labels, import, and upload-ledger surfaces without creating copied demo-only modules.
- [x] 4.2 Ensure the dashboard loads seeded demo filters, KPI cards, spending bars, trend chart, transaction rows, and uncategorized examples without requiring upload.
- [x] 4.3 Ensure demo restrictions are explained at the point of blocked or sample-only import actions.
- [x] 4.4 Add frontend tests covering demo dashboard rendering and demo import entry behavior.

## 5. Vercel Deployment

- [x] 5.1 Add Vercel project configuration or documented settings for build command, static output behavior, and demo environment variables.
- [x] 5.2 Document how to connect Vercel to this repo as a new project and point an existing-site subdomain at it.
- [x] 5.3 Validate a Vercel preview or equivalent local production build starts in demo mode and shows seeded demo data.

## 6. Verification

- [x] 6.1 Run backend test suite for demo mode, import restrictions, seed data, and existing behavior.
- [x] 6.2 Run frontend test suite for dashboard/import demo states and existing non-demo states.
- [x] 6.3 Run production build checks for frontend/backend or Docker paths affected by demo configuration.
- [x] 6.4 Run `openspec validate feat-demo-site --strict` before requesting implementation review.
