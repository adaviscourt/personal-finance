## Why

The app needs a public demo path so prospective users can explore the product without uploading personal financial data or requiring a private local deployment. This should reuse the real application code path closely enough that demo behavior stays representative as the product evolves.

## What Changes

- Add a demo-site capability that can run the app in a public demo configuration with seeded sample data and labels.
- Support Vercel static frontend deployment to a subdomain of an existing site without requiring a separate fork, copied app implementation, or deployed API.
- Prevent public-demo users from importing their own files, or route import entry points to curated sample-file flows that emulate the real import workflow safely.
- Seed demo accounts, transactions, labels, and optional sample import files for a young single US user earning about $100k in a MCOL city, frugal but still spending on social, fitness, travel, and hobbies.
- Keep demo mode close to production parity by gating only demo-specific configuration, seed data, and public-data protections.

## Capabilities

### New Capabilities
- `demo-site`: Public demo deployment mode, seeded demo data, safe demo import behavior, and Vercel-ready configuration.

### Modified Capabilities
- `production-deployment`: Deployment requirements expand to include Vercel demo project configuration for a public subdomain.
- `transaction-import`: Import workflow requirements expand to define safe demo-mode behavior for public visitors.
- `import-upload-management`: Upload ledger requirements expand to make demo sample uploads visible without accepting arbitrary personal files.
- `finance-dashboard`: Dashboard requirements expand to require seeded demo data that exercises real dashboard summaries and filters.

## Impact

- Frontend routing and import UI need a demo-mode branch that reuses existing components while disabling private file upload or selecting bundled sample files.
- Backend/configuration need a demo-mode flag and seed data path for API-backed demos; frontend API code needs a deterministic fake backend for static Vercel public demos.
- Deployment docs/configuration need Vercel setup guidance for the demo project and subdomain.
- Tests need coverage that demo mode blocks personal uploads, exposes sample data, and preserves normal app behavior outside demo mode.
