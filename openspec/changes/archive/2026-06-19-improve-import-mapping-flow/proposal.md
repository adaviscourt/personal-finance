## Why

The current import mapping flow exposes debit/credit split handling as low-level transforms that users must coordinate across amount, direction, and optional fields. This makes common bank exports with separate debit and credit columns feel fragile, and it prevents users from building richer descriptions from multiple source columns such as description plus check number.

## What Changes

- Replace the hacky split amount and split amount direction UX with a prescriptive split debit/credit amount mode that asks whether the amount is split across debit and credit columns, then captures those source columns once.
- Derive both normalized amount and direction from the selected split debit/credit columns when split mode is enabled, while keeping validation for exactly one populated amount source per row.
- Add description composition so users can build Description from multiple source fields, reorder those fields, and join non-empty values with a single space.
- Preserve split-column settings and description composition when templates are saved, selected, edited, previewed, and applied.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `transaction-import`: The import mapping workflow gains prescriptive split debit/credit configuration and ordered multi-column description mapping.
- `import-templates`: Template configuration stores and reloads split-column amount settings and ordered description source parts.
- `transaction-transforms`: Transform behavior derives amount and direction from a single split-column configuration and concatenates description fields in order.

## Impact

- Frontend import UI in `frontend/src/App.tsx` and related styles in `frontend/src/App.css` need clearer controls for split amount mode and description composition.
- Frontend API types in `frontend/src/api/client.ts` need to represent split amount mode and ordered description parts.
- Backend template validation and transform logic in `backend/app/main.py` need to accept and apply composed descriptions and consolidated split amount configuration.
- Backend and frontend tests should cover saving, loading, previewing, validating, and applying these mappings.
