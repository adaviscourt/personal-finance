## 1. Project Foundation

- [x] 1.1 Create the Docker-runnable application structure with separate backend and frontend directories (#1)
- [x] 1.2 Add FastAPI backend dependencies, including SQLite database access, Polars CSV processing, and validation support (#1)
- [x] 1.3 Add Vite + React frontend dependencies, including routing, API client utilities, forms, and charting (#1)
- [x] 1.4 Add Docker and local development commands for running the frontend, backend, and persisted SQLite database (#1)
- [x] 1.5 Add basic backend and frontend health checks to verify the app boots locally (#1)

## 2. Database Schema

- [x] 2.1 Create SQLite schema management for initial database setup (#2)
- [x] 2.2 Add tables for accounts, upload files, raw import rows, import templates, transactions, labels, and transaction label rules (#2)
- [x] 2.3 Seed the fixed MVP label taxonomy, including uncategorized (#2)
- [x] 2.4 Add indexes needed for transaction lookup, duplicate detection, dashboard month queries, and label rule matching (#2)
- [x] 2.5 Add database tests or verification for schema creation and label seeding (#2)

## 3. CSV Upload Preview

- [x] 3.1 Implement backend CSV parsing with Polars for uploaded files (#3)
- [x] 3.2 Implement backend preview response with detected headers and up to 5 parsed data rows (#3)
- [x] 3.3 Implement invalid CSV error handling that does not create importable transactions (#3)
- [x] 3.4 Implement frontend upload UI with file selection and raw preview table (#3)
- [x] 3.5 Surface parsed source columns from preview responses for template mapping controls (#3)

## 4. Import Templates

- [ ] 4.1 Define backend validation models for structured import template configuration (#4)
- [ ] 4.2 Implement template create, list, read, update, and delete APIs (#4)
- [ ] 4.3 Support global templates with optional account association (#4)
- [ ] 4.4 Validate required unified transaction mappings before saving or applying templates (#4)
- [ ] 4.5 Implement frontend template selection during upload preparation (#4)
- [ ] 4.6 Implement frontend template editor for field mappings and transform settings (#4)

## 5. Transaction Transform Engine

- [ ] 5.1 Implement supported transform dispatch that rejects unknown transform types (#5)
- [ ] 5.2 Implement `copy_column`, `parse_date`, `parse_numeric`, and `absolute_numeric` transforms (#5)
- [ ] 5.3 Implement `signed_amount_direction` for deriving debit or credit from a signed amount column (#5)
- [ ] 5.4 Implement `split_amount_direction` for deriving debit or credit from separate debit and credit columns (#5)
- [ ] 5.5 Implement `value_lookup` for mapping unique source values to debit or credit (#5)
- [ ] 5.6 Add API support to return unique values for a selected source column during template configuration (#5)
- [ ] 5.7 Implement transformed preview generation using selected template configuration (#5)
- [ ] 5.8 Add transform tests covering signed amount, split columns, value lookup, unsupported transforms, and transformed preview output (#5)

## 6. Transaction Import

- [ ] 6.1 Persist upload file records and raw parsed rows for import preparation (#6)
- [ ] 6.2 Implement confirm-import API that inserts normalized transactions only after user confirmation (#6)
- [ ] 6.3 Link imported transactions to their upload file and source raw row (#6)
- [ ] 6.4 Persist unified transaction fields, including date, description, amount, direction, account, source metadata, optional balance, optional check number, and optional label (#6)
- [ ] 6.5 Implement deterministic duplicate candidate detection using account, date, normalized description, amount, and direction (#6)
- [ ] 6.6 Show duplicate candidate warnings before final insertion (#6)
- [ ] 6.7 Add import tests covering confirmed import, unconfirmed preview, raw row storage, source links, and duplicate detection (#6)

## 7. Transaction Labeling

- [ ] 7.1 Implement backend APIs to list fixed labels and existing label rules (#7)
- [ ] 7.2 Implement backend API to create merchant or description match rules using predefined labels only (#7)
- [ ] 7.3 Apply label rules to matching existing transactions (#7)
- [ ] 7.4 Apply saved label rules to newly imported transactions (#7)
- [ ] 7.5 Ensure unmatched transactions resolve to uncategorized in label-based views (#7)
- [ ] 7.6 Implement frontend transaction labeling UI for creating match rules and assigning predefined labels (#7)
- [ ] 7.7 Add labeling tests for fixed labels, custom label prevention, rule application, future import matching, and uncategorized fallback (#7)

## 8. Finance Dashboard

- [ ] 8.1 Implement backend dashboard query for monthly debit totals grouped by label (#8)
- [ ] 8.2 Exclude credit transactions from spending-by-label dashboard totals (#8)
- [ ] 8.3 Implement frontend month selector for dashboard filtering (#8)
- [ ] 8.4 Implement pie chart visualization grouped by label for the selected month (#8)
- [ ] 8.5 Implement empty state when the selected month has no debit transactions (#8)
- [ ] 8.6 Add dashboard tests for month filtering, debit-only totals, label grouping, and empty state behavior (#8)

## 9. End-to-End Validation

- [ ] 9.1 Add sample CSV fixtures for signed amount, split debit/credit columns, and source value lookup direction patterns (#9)
- [ ] 9.2 Verify an upload can be previewed, mapped, transformed, confirmed, labeled, and charted through the UI (#9)
- [ ] 9.3 Verify Docker startup instructions work from a clean checkout (#9)
- [ ] 9.4 Run backend tests, frontend tests, and any lint/type checks available in the project (#9)
- [ ] 9.5 Update README with setup, Docker usage, and MVP workflow instructions (#9)
