## Context

The import flow already supports account-scoped templates, transformed previews, and split debit/credit columns through `split_amount` and `split_amount_direction` mappings. The current UI exposes those implementation details directly: users must set optional debit and credit columns, choose two matching transforms, and leave amount source empty. Description mapping only copies one source column, so common exports that separate memo, description, and check number cannot produce a useful normalized description without editing the CSV first.

The change spans frontend template editing, frontend API types, backend template validation, backend transform application, and tests.

## Goals / Non-Goals

**Goals:**

- Make split debit/credit amount mapping explicit and hard to misconfigure.
- Let users compose Description from multiple source columns in a chosen order.
- Save, reload, preview, and apply these mappings through existing import template flows.
- Preserve current validation that split rows must have exactly one populated debit or credit amount.

**Non-Goals:**

- No general expression language for arbitrary transforms.
- No custom separators beyond a single space between non-empty description parts.
- No drag-and-drop dependency if accessible up/down controls can provide equivalent ordering.
- No changes to persisted transaction schema.

## Decisions

### Decision: Present split debit/credit as amount mode, not two raw transforms

The mapping UI will offer an amount choice such as "single amount column" or "split debit/credit columns". When split mode is enabled, users select debit and credit source columns in a dedicated panel, and the app generates amount and direction mapping config consistently.

Rationale: users think of this as a CSV layout choice, not two independent transforms. One mode prevents amount/direction drift and keeps validation contextual.

Alternative considered: keep current transform dropdowns and improve helper text. That leaves the main misconfiguration path intact.

### Decision: Store ordered description parts in template config

Description mapping will support an ordered list of source columns. The transform joins non-empty trimmed values with one space. A single-column description remains the default and can be serialized as the first part for compatibility with the existing mental model.

Rationale: multi-part descriptions are common for bank exports and the output should affect duplicate detection, label matching, and dashboard display exactly like any other imported description.

Alternative considered: map check number only into the existing optional check number field. That preserves metadata but does not solve readable description composition.

### Decision: Keep backend transform logic deterministic and row-local

Split debit/credit and composed description transforms will use only values from the current raw row and saved template config. Validation happens before preview/import returns success, and row-level ambiguity remains a prepare error.

Rationale: deterministic row-local transforms are easy to test, safe for previews, and match current import architecture.

Alternative considered: add client-only preview composition. That would diverge from confirmed import behavior and risk saved templates importing different rows later.

### Decision: Prefer accessible reorder controls, optional drag enhancement

The UI can support drag reorder if lightweight, but it must include keyboard-accessible up/down controls and clear order numbers.

Rationale: drag-only ordering is poor for accessibility and mobile precision. Up/down controls satisfy the requirement; drag can be progressive enhancement.

Alternative considered: fixed order by selection time only. That fails explicit reorder needs.

## Risks / Trade-offs

- Existing templates with raw `split_amount` and `split_amount_direction` config may still load into the new split amount mode -> Mitigation: derive UI state from existing debit/credit mapping fields when applying a template.
- Adding `description_parts` changes template config shape -> Mitigation: keep existing `source_column` path valid for single-column descriptions and convert to one-part UI state on load.
- Description composition can change duplicate fingerprints and label matches -> Mitigation: apply only to future imports using updated templates and show transformed preview before confirmation.
- Split row validation can be hidden if the first preview rows are clean but later rows are ambiguous -> Mitigation: ensure prepare/confirm paths validate all imported rows, not only preview rows.

## Migration Plan

- Existing templates continue to load with their saved mappings.
- Templates using split transforms are displayed as split debit/credit amount mode with saved debit and credit columns selected.
- Templates using a single description source display one description part.
- Rollback is code-only because transaction persistence schema is unchanged; templates saved with new `description_parts` would need the new backend to apply composed descriptions.
