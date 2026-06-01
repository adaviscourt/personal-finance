## Context

This is a new personal finance web application. The first meaningful product surface is an import pipeline that turns inconsistent bank and credit card CSV exports into a unified transaction dataset that can support labels and dashboards.

The application should run in Docker and use a lightweight local database. The selected stack is Vite + React for the frontend, FastAPI for the backend, SQLite as the system of record, and Polars for CSV parsing, preview, and transformation.

CSV exports are expected to vary by institution and account type. Known source patterns include signed amount columns, split debit/credit columns, and semantic type fields where each unique source value must map to a debit or credit direction. The design should support those MVP cases without closing the door on future transformation types.

## Goals / Non-Goals

**Goals:**

- Provide a Docker-runnable single-user MVP for uploading and importing financial CSV files.
- Store raw uploaded row data so imports can be inspected, explained, and reprocessed.
- Represent import templates as validated structured configuration rather than executable SQL or user-authored code.
- Normalize imported rows into a unified transactions table that supports downstream analytics.
- Support reusable and editable templates for recurring account exports.
- Support an extensible transformation model, starting with debit/credit direction derivation.
- Provide fixed transaction labels and a basic monthly label pie chart.

**Non-Goals:**

- Multi-user authentication or authorization.
- Bank API integrations.
- Custom user-defined labels.
- Advanced dashboards beyond the initial monthly label chart.
- Arbitrary SQL, Python, or JavaScript execution inside import templates.
- Full duplicate resolution workflows beyond basic duplicate detection for likely repeated imports.

## Decisions

### Use SQLite as the system of record

SQLite will store application state, including accounts, uploads, raw rows, templates, transactions, labels, and label rules.

Rationale: the app is local/personal in nature, must be lightweight, and needs reliable CRUD-oriented storage more than a dedicated analytical database. SQLite is simple to run in Docker, easy to persist via a mounted volume, and more than sufficient for the target MVP scale.

Alternatives considered:

- DuckDB: stronger for analytical queries and CSV ingestion, but less natural as the primary CRUD database for templates, uploads, and label rules.
- Postgres: robust and familiar for web apps, but adds operational weight that is unnecessary for the MVP.

### Use Polars for CSV parsing and transformation

The backend will use Polars to parse uploaded CSV files, generate previews, inspect unique column values, apply template transformations, and produce normalized rows for insertion.

Rationale: import behavior is data-transformation-heavy. Polars provides fast CSV handling, strong expression primitives, and good performance headroom for files up to and beyond 50,000 rows.

Alternatives considered:

- Pandas: familiar and sufficient for the MVP size, but generally less strict and less performant for larger transformation pipelines.
- Direct SQLite import: useful for storage, but less ergonomic for interactive preview and configurable transformation logic.

### Store templates as structured JSON config, not executable code

Import templates will be persisted as JSON configuration describing source columns, target fields, transform types, transform parameters, and fallbacks.

Example conceptual shape:

```json
{
  "mappings": {
    "date": { "sourceColumn": "Date", "transform": "parse_date" },
    "amount": { "sourceColumn": "Amount", "transform": "absolute_numeric" },
    "direction": {
      "sourceColumn": "Type",
      "transform": "value_lookup",
      "rules": {
        "Payment": "credit",
        "Return": "credit",
        "Sale": "debit",
        "Fee": "debit"
      }
    }
  }
}
```

Rationale: structured config can be validated, edited through the UI, versioned later, and safely interpreted by the backend. It avoids the security and maintainability risks of storing arbitrary SQL or script logic.

Alternatives considered:

- SQL templates: close to the existing dbt examples, but hard to expose safely in a UI and difficult to validate incrementally.
- User-authored code snippets: highly flexible, but not appropriate for an MVP and unsafe without sandboxing.

### Define transformation primitives instead of one-off importer code

The MVP transform engine will expose a small set of named primitives:

- `copy_column`
- `parse_date`
- `parse_numeric`
- `absolute_numeric`
- `signed_amount_direction`
- `split_amount_direction`
- `value_lookup`

Rationale: the known import cases can be composed from these primitives while keeping the system extensible. Future transforms can be added as new named operations without changing the template concept.

### Persist raw rows alongside normalized transactions

Each upload will store its raw parsed rows, likely as JSON per row, before or during confirmed import. Normalized transactions will retain a reference back to the source upload and raw row.

Rationale: financial imports need traceability. Raw row persistence supports debugging, explaining how a transaction was produced, and reprocessing if a template is edited later.

Trade-off: this duplicates data and modestly increases storage. For personal finance CSV sizes, that is acceptable.

### Require transformed preview before final import

The user should see both the raw 5-row preview and a transformed preview generated by the selected template before committing rows to the transactions table.

Rationale: source previews show what was uploaded, but transformed previews show whether the mapping is correct. This prevents bad templates from silently polluting the unified transaction table.

### Use a fixed label taxonomy with reusable match rules

The MVP will seed a fixed label set such as housing, auto, groceries, paychecks, life, utilities, dining, subscriptions, transfers, and uncategorized. Users can assign labels by matching merchant or description patterns, and those rules can apply to future transactions.

Rationale: labels must drive dashboards, so unconstrained custom labels are deferred. Reusable rules reduce repetitive manual labeling across monthly imports.

### Keep the first dashboard intentionally small

The dashboard will initially provide a month selector and pie chart grouped by label.

Rationale: the import system is the hard foundation. A small dashboard proves the normalized transaction model without over-designing analytics before the data pipeline exists.

## Risks / Trade-offs

- Bad template configuration could create incorrect transactions -> Require transformed preview before import and keep raw row references for inspection.
- Duplicate uploads could insert repeated transactions -> Generate a deterministic fingerprint from account, date, normalized description, amount, and direction; detect likely duplicates before insertion.
- CSV parsing edge cases could break imports -> Return parse errors with row and column context where possible, and avoid partial confirmed imports unless explicitly supported later.
- Template JSON can become too flexible or inconsistent -> Validate template configs against explicit backend schemas and support only known transform types.
- SQLite write concurrency is limited -> Acceptable for single-user MVP; keep imports transactional and revisit if multi-user support is introduced.
- Label rules may over-match broad descriptions -> Show affected transactions before applying rules when practical, and keep uncategorized as a safe default.

## Migration Plan

This is a new project, so there is no production migration. Initial implementation should create the application schema from scratch and seed the fixed label taxonomy.

Rollback for the MVP is limited to removing the container/database volume or restoring a previous SQLite file backup.

## Open Questions

- Should import templates be global, account-specific, or global with optional account association? The preferred MVP direction is global templates that can optionally be linked to an account.
- Should template edits affect only future imports, or should the app support reprocessing prior uploads with the edited template?
- What exact fields are required in the unified transaction schema for the MVP beyond date, description, amount, direction, account, source type/category, check number, balance, and label?
- Should duplicate detection block import, warn and allow override, or skip matching rows automatically?
