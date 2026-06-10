## 1. Backend Dashboard Data

- [x] 1.1 Add response models for dashboard transaction rows with transaction, account, and label display fields. (#32)
- [x] 1.2 Add filtered dashboard transaction-list API using required month and optional account and label filters. (#32)
- [x] 1.3 Return uncategorized transaction rows consistently when label filters target uncategorized transactions. (#32)
- [x] 1.4 Add backend tests for month, account, label, uncategorized, credit/debit, and empty transaction-list cases. (#32)

## 2. Frontend Data Client

- [x] 2.1 Add frontend API types and client function for dashboard transaction rows. (#29)
- [x] 2.2 Keep existing account and label list client functions reusable by dashboard and modules. (#29)
- [x] 2.3 Update frontend tests or mocks for new dashboard transaction data. (#29)

## 3. App Navigation And Routes

- [x] 3.1 Add primary app navigation with dashboard, import, labeling, and accounts links. (#34)
- [x] 3.2 Split route components so `/` renders dashboard-only content. (#34)
- [x] 3.3 Move CSV import, template editing, transformed preview, duplicate warnings, and confirmation into the import route. (#34)
- [x] 3.4 Move transaction label rule creation and rule list review into the labeling route. (#34)
- [x] 3.5 Move account listing, creation, rename, delete, and confirmation controls into the accounts route. (#34)
- [x] 3.6 Remove persistent backend health and database status UI from user-facing app surfaces. (#34)

## 4. Dashboard Experience

- [x] 4.1 Add dashboard filters for month, optional accounts, and optional label. (#30)
- [x] 4.2 Render dashboard transaction table with date, account, description or merchant, label, direction, and amount. (#30)
- [x] 4.3 Add empty, loading, and contextual API error states for dashboard data. (#30)
- [x] 4.4 Keep spending-by-label data only as a secondary summary if retained, not the primary dashboard content. (#30)
- [x] 4.5 Ensure dashboard table remains usable on narrow screens. (#30)

## 5. Guided Import And Module Handoff

- [x] 5.1 Present import workflow in account, source file, mappings, transformed preview, warning review, confirm order. (#28)
- [x] 5.2 Show contextual import validation for missing file, account, or mappings. (#28)
- [x] 5.3 After successful import, provide a clear path to review the imported month in the dashboard. (#28)
- [x] 5.4 Require account-scoped import templates and route users without accounts to account management.
- [x] 5.5 Remove bootstrap default account creation so first-run import uses explicit account setup.

## 6. Visual System

- [x] 6.1 Replace pastel hero/card styling with restrained product surfaces aligned to `PRODUCT.md`. (#31)
- [x] 6.2 Apply consistent buttons, inputs, selects, tables, focus states, and status messages across modules. (#31)
- [x] 6.3 Use FreeTaxUSA-inspired green primary actions and blue support accents with WCAG AA contrast. (#31)
- [x] 6.4 Remove decorative eyebrows and oversized hero heading treatment from app modules. (#31)

## 7. Verification

- [x] 7.1 Run backend tests. (#33)
- [x] 7.2 Run frontend tests. (#33)
- [x] 7.3 Run frontend build or typecheck. (#33)
- [x] 7.4 Manually verify dashboard, import, labeling, and account routes in the browser or dev server. (#33)
