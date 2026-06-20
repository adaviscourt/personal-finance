## 1. Backend Template Config

- [x] 1.1 Extend backend template mapping models to support ordered description source parts while preserving single `source_column` descriptions.
- [x] 1.2 Add backend validation for composed descriptions, split debit/credit amount mode, and missing source columns.
- [x] 1.3 Update transform logic to concatenate non-empty description parts with one space in saved order.
- [x] 1.4 Update split debit/credit transform logic so one split configuration can derive amount and direction consistently.

## 2. Frontend Mapping UX

- [x] 2.1 Replace raw split amount and split amount direction setup with an explicit single amount vs split debit/credit amount choice.
- [x] 2.2 Add dedicated debit and credit source column selectors shown only for split debit/credit amount mode.
- [x] 2.3 Add Description field composition controls for selecting multiple source columns and reordering them with accessible controls.
- [x] 2.4 Update template save/load state so existing templates preload split settings and single-column descriptions correctly.

## 3. API Types and Integration

- [x] 3.1 Update frontend API types for description parts and consolidated split amount config.
- [x] 3.2 Update template config construction for new mapping UI and transformed preview requests.
- [x] 3.3 Ensure selected templates, saved templates, transformed preview, prepare, and confirm paths all use the same config shape.

## 4. Verification

- [x] 4.1 Add backend tests for composed descriptions, empty part skipping, reordered parts, split debit rows, split credit rows, and ambiguous split rows.
- [x] 4.2 Add frontend tests for split mode controls, description part ordering, template save payloads, and template reload behavior.
- [x] 4.3 Run backend and frontend test suites.
- [x] 4.4 Manually verify import flow on desktop and mobile widths for account selection, CSV preview, template mapping, transformed preview, and confirmation.
