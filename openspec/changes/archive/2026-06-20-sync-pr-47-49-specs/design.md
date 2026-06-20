## Context

PRs 47-49 expanded the app from an MVP import/dashboard into a more complete local finance tool with account-aware imports, scoped labels, dashboard trend review, rule lifecycle management, and production deployment. The implementation spans the FastAPI backend, SQLModel persistence, React frontend, tests, Docker packaging, GitHub release automation, and Unraid metadata.

The OpenSpec artifacts need to describe the behavior already shipped so future verification can compare code, tests, and docs against one source of truth.

## Goals / Non-Goals

**Goals:**

- Capture the shipped dashboard, import, labeling, transform, template, account, and deployment behavior in specs.
- Document data model and API choices that affect migrations, rule cleanup, dashboard summaries, and deployment persistence.
- Keep verification actionable by mapping requirements to implemented files and tested behavior.
- Preserve the local-first SQLite model while supporting container deployment.

**Non-Goals:**

- Redesign the data model beyond the PR 47-49 implementation.
- Add authentication, multi-user access control, cloud sync, or external bank integrations.
- Replace SQLite or add a full migration framework.
- Rework UI styling beyond documenting the implemented frontend behavior.

## Decisions

### Decision: Store label scope and controllability on labels

Labels carry optional `account_id`, `is_controllable`, `is_system`, and a generated slug that includes scope/control when needed. This allows the same display name to exist globally or per account, and to differ by controllable versus non-controllable classification.

Alternative considered: keep labels as a fixed global taxonomy and store control metadata separately. That would keep the old model simpler but would not support account-specific label meaning or dashboard controllable splits.

### Decision: Let label rules inherit account scope from the selected label

Transaction label rules store `account_id` and derive it from the target label. Match preview also uses the selected label to limit account-scoped results. This prevents a rule for one account-specific label from applying to unrelated accounts.

Alternative considered: expose account selection separately on rules. That creates conflicting scope choices when selected label and selected account disagree.

### Decision: Track rule provenance on labeled transactions

Transactions include `label_rule_id` so edits and deletes can remove labels applied by a specific rule before applying the replacement rule or deleting the rule. Legacy rows without provenance are cleared only when they still match the old rule and label.

Alternative considered: recompute all labels after every rule edit. That is simpler conceptually but risks disrupting manual labels and unrelated rule assignments.

### Decision: Keep dashboard aggregation in frontend from API row data

The backend exposes dashboard transaction rows with label metadata. The frontend computes KPI buckets, controllable splits, spending bars, sorting, persisted filters, and seven-month trend rendering from API responses.

Alternative considered: add dedicated summary endpoints for every visualization. That could reduce frontend work but increases backend API surface before the dashboard stabilizes.

### Decision: Model split debit/credit imports as template transforms

Separate debit and credit CSV columns are supported through `split_amount` and `split_amount_direction` transform mappings, with debit/credit source columns attached to the mapping. This keeps split-column bank exports inside the existing template pipeline.

Alternative considered: add a separate import mode for split-column files. That would duplicate preview, validation, and confirmation logic.

### Decision: Serve production frontend from FastAPI container

The Docker image builds the React frontend with an empty API base URL, copies static assets into the backend image, and serves UI plus API on port 8000. The image defaults `DATABASE_URL` to `sqlite:////data/personal_finance.db`.

Alternative considered: separate frontend and backend containers. That adds deployment complexity for Unraid and requires cross-container routing for a local-first app.

### Decision: Publish container images from GitHub releases

The GitHub Actions workflow builds and pushes GHCR images when a release is published, then attaches build provenance. This keeps release tags aligned with installable container images.

Alternative considered: publish on every main push. That creates deployable images for unreviewed intermediate states.

## Risks / Trade-offs

- SQLite schema drift without a migration framework -> keep additive startup migrations idempotent and covered by tests.
- Frontend-derived dashboard summaries may diverge from future backend summary APIs -> keep row API metadata complete and test visible totals.
- Regex label rules can be expensive or invalid -> validate regex server-side, debounce previews client-side, and limit preview rows.
- Rule edit/delete cleanup can remove labels unexpectedly for legacy rows -> only clear legacy labels that still match the old rule and old label.
- Single-container deployment couples frontend release to backend release -> acceptable for local-first Unraid install, with rollback by pulling previous image tag.
- Persistent data depends on correct host path mapping -> document `/data` and expose Unraid template path/env settings.

## Migration Plan

- Additive SQLite startup migrations create label account scope, label controllability, label rule account scope, rule match type, and transaction rule provenance columns when missing.
- Existing system labels are reseeded with controllability metadata without deleting user data.
- Production deployments preserve data by mounting host storage to `/data` and keeping `DATABASE_URL` under `/data`.
- Rollback uses the previous GHCR image tag while retaining the same `/data` mount. Additive columns remain harmless to older compatible code but should not be manually removed.

## Open Questions

- Whether future dashboard summaries should move from frontend aggregation to backend summary endpoints once trend and KPI requirements stabilize.
- Whether a formal migration tool is needed before non-additive schema changes.
