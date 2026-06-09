## Context

The frontend is a Vite/React single-page app. The current root route renders one large `Home` component that owns API health, account CRUD, dashboard charting, CSV upload, import template editing, import confirmation, and label rule management. Current CSS uses a hero/card structure with oversized headings, pastel-tinted panels, and user-visible backend status.

The product direction in `PRODUCT.md` is product UI, not marketing UI: dashboard first, workflows in modules, trust through clarity, guided import steps, and a FreeTaxUSA-inspired visual tone adapted for a dense app surface.

Existing backend data supports transactions, accounts, labels, imports, templates, and dashboard spending-by-label totals. The current dashboard endpoint returns debit totals grouped by label; it does not return filtered transaction rows for a full dashboard table.

## Goals / Non-Goals

**Goals:**

- Make `/` a dashboard-only route focused on month-filtered transaction review.
- Provide module routes for import, labeling, and account management.
- Add app-level navigation that makes modules discoverable without crowding the dashboard.
- Add transaction-table data access filtered by month, optional accounts, and optional labels.
- Preserve existing import, labeling, account, and chart capabilities while relocating or de-emphasizing them.
- Replace the current pastel hero/card visual approach with a restrained product UI: white surfaces, clear table hierarchy, green primary actions, blue support accents, consistent controls, and WCAG AA contrast.

**Non-Goals:**

- No bank connection, authentication, multi-user sync, budgeting, or recurring transaction automation.
- No custom label taxonomy beyond the current MVP labels.
- No major data model migration unless the transaction table endpoint needs additional indexes.
- No attempt to clone FreeTaxUSA exactly; the goal is a similar trustworthy simplicity adapted to this app.

## Decisions

### Route-level module separation

Use route-level surfaces for dashboard, import, labeling, and account management instead of conditionally stacking all workflows on `/`.

Rationale: This matches the product principle that workflows belong in modules. It also lets each screen have a clear task and simpler loading/error states.

Alternative considered: Keep one page and hide sections behind tabs. This reduces routing work but keeps unrelated state in one component and makes the home page remain a multipurpose console.

### Dashboard table as primary home content

The dashboard home should show filters, summary, and a full transaction table. Spending-by-label chart data can remain available as a compact summary or secondary insight, but table review is the primary dashboard interaction.

Rationale: Personal finance review starts with transaction-level trust. A chart answers “how much by category,” but a table answers “what happened and does it look right?”

Alternative considered: Keep the pie chart as the dominant dashboard. This preserves current behavior but conflicts with the requested dashboard focus and makes filtering less useful.

### Add filtered transaction list API

Add a backend endpoint for dashboard transaction rows filtered by required month and optional account ids and label ids/slugs. Response rows should include transaction id, date, account, description or merchant, label, direction, amount, and source context needed for review.

Rationale: The existing chart endpoint only returns grouped debit totals. The frontend needs normalized rows without reconstructing them from import previews or adding client-side filtering over all transactions.

Alternative considered: Expand `/dashboard/spending-by-label` to include rows. That couples summary and table data unnecessarily and makes the endpoint name misleading.

### Preserve module workflow state locally

Keep import/template/label/account state scoped to their modules instead of lifting all state into a global app shell.

Rationale: The app is local-first and small. Route-level component state is simpler and avoids adding state-management dependencies.

Alternative considered: Introduce global state for accounts, labels, and filters. This may help later, but it is premature for current complexity.

### Account-first import templates

The import module should require account selection before CSV upload and template selection. Import templates are account-scoped, so choosing the account first makes the template dropdown predictable and avoids a separate global-template concept. If no accounts exist, the import module should send the user to the accounts module before continuing.

Rationale: Templates are shaped by bank/account export formats. Showing templates before the controlling account selector makes the workflow feel broken because the dropdown changes based on a control below it.

Alternative considered: Keep global templates visible for every account. This simplifies reuse but creates unclear ownership and conflicts with account-specific statement formats.

### No bootstrap default account

Clean databases should start with no accounts instead of seeding `Default Account`. First-run import now has an explicit no-account state that sends users to account management, which is clearer than silently creating a generic account that users may not understand.

Rationale: Account-scoped templates and account-first import make the account an intentional user choice. A synthetic account can hide setup, pollute filters, and create template ownership confusion.

Migration: Do not auto-delete existing `Default Account` rows. Existing rows remain ordinary accounts and can be deleted by the user.

### FreeTaxUSA-inspired product visual direction

Use FreeTaxUSA as a trust reference, not a marketing-page clone. Apply restrained white/near-white surfaces, green primary actions, blue secondary/trust accents, clear bordered tables, readable forms, modest radii, and plain language. Avoid pastel panel sprawl, oversized hero copy, decorative eyebrows, and visual noise.

Rationale: The target workflow involves personal financial data. The UI should feel safe, plain, and competent.

Alternative considered: Keep the current warm-card aesthetic and only rearrange content. That would reduce work but leave the product feeling less credible and less aligned with the new direction.

## Risks / Trade-offs

- Route split may expose duplicated account/label fetching across modules → Keep duplication minimal first; extract shared hooks only if implementation shows real repetition.
- Transaction table can become crowded on mobile → Use responsive table containment and prioritize date, description, label, and amount on narrow screens.
- New transaction-list endpoint may need pagination later → Start with current-month scope and add predictable ordering; defer pagination until data volume demands it.
- FreeTaxUSA visual reference could drift into marketing styling → Anchor decisions in product UI rules from `PRODUCT.md`: table clarity, guided workflows, and restrained color.
- Removing visible health status could hide local backend failures → Surface backend failures as contextual loading/error messages on the affected module instead of a permanent health card.

## Migration Plan

1. Add backend transaction-list behavior and tests while keeping existing dashboard chart endpoint intact.
2. Split frontend route surfaces and move existing account/import/label UI into dedicated modules.
3. Convert `/` to dashboard-only content backed by filtered transaction rows.
4. Apply restrained visual system and remove the health card from user-facing home UI.
5. Update frontend tests around route navigation, dashboard filters, table rendering, and relocated workflows.

Rollback: keep existing backend endpoints unchanged while adding the transaction-list endpoint. If route split causes regressions, the previous single-route UI can be restored without data migration.

## Open Questions

- Should the dashboard table filter by label id, label slug, or both? Slug is friendlier for URLs; id is simpler with current label selectors.
- Should account management be its own route (`/accounts`) or grouped under import settings? Dedicated route is clearer for now.
- Should the spending-by-label chart remain visible on dashboard as a compact summary, or move behind an “Insights” affordance?
