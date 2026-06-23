## 1. Demo Runtime And Configuration

- [ ] 1.1 Verify the current frontend/backend build can run in Vercel demo deployment, or document the smallest required adapter if FastAPI cannot run directly there.
- [ ] 1.2 Add an explicit demo-mode configuration flag available to backend and frontend without changing normal local/container defaults.
- [ ] 1.3 Add demo-mode tests proving non-demo deployments keep existing import, persistence, and dashboard behavior.

## 2. Seeded Demo Data

- [ ] 2.1 Create deterministic synthetic demo seed data for checking, savings, and credit card accounts.
- [ ] 2.2 Seed salary income near $100k annualized plus realistic MCOL spending across rent, groceries, utilities, transportation, insurance, subscriptions, dining, entertainment, fitness, travel, savings, and hobbies.
- [ ] 2.3 Seed labels and label metadata that exercise controllable, non-controllable, account-scoped, global, and uncategorized dashboard states.
- [ ] 2.4 Seed source metadata and upload records needed for dashboard and upload-ledger parity.
- [ ] 2.5 Add backend tests verifying demo data initializes deterministically and contains no real personal data.

## 3. Safe Demo Import Flow

- [ ] 3.1 Decide whether first implementation supports bundled sample-file imports or disables import creation in demo mode, based on implementation complexity discovered during coding.
- [ ] 3.2 If sample imports are supported, add bundled synthetic sample CSV files and route selection through the existing guided import flow.
- [ ] 3.3 If sample imports are not supported, disable demo import creation with clear explanatory copy while keeping upload history visible.
- [ ] 3.4 Block arbitrary visitor file upload in demo mode before raw rows or transactions are persisted.
- [ ] 3.5 Add backend and frontend tests for sample-file import or disabled-import behavior, including rejection of arbitrary files.

## 4. Demo UI Parity

- [ ] 4.1 Wire demo mode into existing dashboard, accounts, labels, import, and upload-ledger surfaces without creating copied demo-only modules.
- [ ] 4.2 Ensure the dashboard loads seeded demo filters, KPI cards, spending bars, trend chart, transaction rows, and uncategorized examples without requiring upload.
- [ ] 4.3 Ensure demo restrictions are explained at the point of blocked or sample-only import actions.
- [ ] 4.4 Add frontend tests covering demo dashboard rendering and demo import entry behavior.

## 5. Vercel Deployment

- [ ] 5.1 Add Vercel project configuration or documented settings for build command, output/runtime behavior, and demo environment variables.
- [ ] 5.2 Document how to connect Vercel to this repo as a new project and point an existing-site subdomain at it.
- [ ] 5.3 Validate a Vercel preview or equivalent local production build starts in demo mode and shows seeded demo data.

## 6. Verification

- [ ] 6.1 Run backend test suite for demo mode, import restrictions, seed data, and existing behavior.
- [ ] 6.2 Run frontend test suite for dashboard/import demo states and existing non-demo states.
- [ ] 6.3 Run production build checks for frontend/backend or Docker paths affected by demo configuration.
- [ ] 6.4 Run `openspec validate feat-demo-site --strict` before requesting implementation review.
