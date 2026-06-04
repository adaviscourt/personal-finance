## Approval
Approver: adaviscourt
Date: 2026/05/31

## Why

Personal finance CSV exports vary widely by institution and account type, which makes meaningful analysis difficult without a repeatable import and normalization process. This change creates the MVP foundation for uploading statement CSVs, mapping them into a unified transactions model, labeling activity, and visualizing monthly spending at a basic level.

## What Changes

- Add a Docker-runnable web application using a Vite + React frontend, FastAPI backend, SQLite database, and Polars-based CSV processing.
- Add CSV upload support with a 5-row raw preview before import.
- Add reusable import templates that map source CSV columns into a unified transactions schema.
- Add an extensible transformation model for import templates, with MVP support for deriving debit/credit direction from signed amounts, split debit/credit columns, and user-defined source value mappings.
- Add editable templates so future uploads for the same account or export format can reuse previously configured mappings and transformations.
- Add transaction import into a unified SQLite-backed transactions table after template application and user confirmation.
- Add a fixed set of labels for transactions, without custom labels in the MVP.
- Add manual merchant or description labeling rules that can apply labels to existing transactions and support future imports.
- Add a basic analytics dashboard with a month selector and pie chart grouped by label.

## Capabilities

### New Capabilities

- `csv-upload-preview`: Upload statement CSV files and preview parsed rows before import.
- `import-templates`: Create, edit, select, and apply reusable mappings from source CSV schemas to the unified transaction schema.
- `transaction-transforms`: Define and apply structured transformation steps for normalized fields, including debit/credit direction logic.
- `transaction-import`: Persist normalized transactions from uploaded files into the application database.
- `transaction-labeling`: Apply a fixed label taxonomy to transactions using manual merchant or description matching rules.
- `finance-dashboard`: Visualize monthly transaction totals by label in an initial dashboard view.

### Modified Capabilities

None.

## Impact

- Introduces the initial application stack: Vite, React, FastAPI, SQLite, Polars, and Docker.
- Creates the initial database model for accounts, uploaded files, raw import rows, import templates, transactions, labels, and label rules.
- Adds backend APIs for CSV preview, template management, import confirmation, transaction labeling, and dashboard data.
- Adds frontend views for upload preview, template configuration, transformed preview, labeling, and the initial monthly label chart.
- Establishes the unified transaction schema that future analytics dashboards will depend on.
