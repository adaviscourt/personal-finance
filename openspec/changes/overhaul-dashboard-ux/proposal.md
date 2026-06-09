## Approval
Approver: adaviscourt
Date: 2026/06/06

## Why

The current home page mixes dashboard review, account management, CSV import, template editing, transformed previews, transaction labeling, and backend health status into one crowded surface. This makes the app feel like a development console instead of a trustworthy personal finance tool focused on monthly transaction review.

## What Changes

- Make the home page a dashboard-only surface focused on monthly transactions.
- Remove the visible backend health check area from user-facing home UI.
- Replace the chart-first dashboard with a full transactions table filtered by month, account, and label.
- Move CSV import, import templates, transformed preview, and import confirmation into a separate import module.
- Move transaction label rule management into a separate labeling module.
- Move account management out of the home dashboard and into a separate module or dedicated management surface.
- Add simple app navigation so dashboard, import, labeling, and account workflows are discoverable without sharing one page.
- Redesign the visual system toward a FreeTaxUSA-inspired product UI: trustworthy, simple, guided, restrained green/blue branding, and clear tables/forms.

## Capabilities

### New Capabilities

- `app-navigation`: Defines navigation between dashboard, import, labeling, and account management modules.

### Modified Capabilities

- `finance-dashboard`: Dashboard requirements change from chart-only spending summary to dashboard-only home with transaction table and month/account/label filtering.
- `transaction-import`: Import workflow requirements change so upload, templates, preview, and confirmation live in a dedicated import module instead of the home page.
- `import-templates`: Import template requirements change so templates are account-scoped rather than globally reusable.
- `transaction-labeling`: Label rule management requirements change so labeling controls live in a dedicated labeling module while labels remain available as dashboard filters.
- `account-management`: Account management requirements change so account CRUD lives outside the home dashboard while accounts remain available in dashboard and import selectors.

## Impact

- Frontend routes, navigation, component structure, and CSS visual system.
- Dashboard API behavior may need a transaction-list endpoint or expanded dashboard endpoint to return filtered transaction rows by month, optional accounts, and optional labels.
- Existing spending-by-label chart behavior may become secondary to transaction-table review or move into a dashboard summary area.
- Frontend tests will need updates for route separation, dashboard table filtering, and removed health check UI.
