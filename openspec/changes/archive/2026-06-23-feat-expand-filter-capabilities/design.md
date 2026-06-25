## Context

The dashboard currently keeps month, account, and label filters in `frontend/src/App.tsx`, loads filtered transaction rows from `/dashboard/transactions`, and derives KPI, spending, and net activity data from those rows. Labels already carry `is_controllable` metadata, but dashboard controls do not expose controllability as a filter.

## Goals / Non-Goals

**Goals:**

- Add a dashboard controllability filter with choices for controllable labels, non-controllable labels, or both.
- Keep label selection semantics intact while making all-selected state show a "Deselect all labels" action.
- Allow users to reveal rows hidden only by label deselection, grey those rows in the table, and keep them out of dashboard summaries.
- Let users click a net activity month point to update the active month filter.

**Non-Goals:**

- No new label taxonomy or controllability model changes.
- No import, labeling-rule, account-management, or navigation behavior changes.
- No new charting dependency.

## Decisions

- Use one frontend controllability filter state with values `both`, `controllable`, and `non-controllable`.
  - Rationale: the issue names exactly three modes and labels already expose boolean controllability metadata.
  - Alternative considered: two independent checkboxes. Rejected because it creates an empty state that is not requested and makes "both" less explicit.
- Treat hidden records as rows excluded by label selection only.
  - Rationale: the issue defines hidden records as deselected-label records. Month, account, and controllability remain active filters because they define the dashboard scope.
  - Alternative considered: show rows hidden by any filter. Rejected because it would make account/month filtering ambiguous and broaden scope.
- Fetch broad rows for hidden-label display when the toggle is enabled, then mark table rows hidden in the client when their label is not selected.
  - Rationale: current API already returns rows by month/account and label metadata. The client can derive label-hidden state without persisting extra row data.
  - Alternative considered: add a dedicated hidden-row response field. Rejected unless implementation proves current response cannot support testable hidden-row marking.
- Apply controllability filtering at the dashboard transaction API and mirror it in spending/net requests.
  - Rationale: summaries and seven-month net trend must use the same controllability scope as the table, and backend filtering avoids over-fetching trend months.
  - Alternative considered: client-only filtering. Rejected because spending-by-label data and trend requests would need duplicated filtering logic.
- Make chart points keyboard/focus accessible while adding click selection.
  - Rationale: points already expose focusable tooltip labels; month selection should remain usable beyond pointer input.

## Risks / Trade-offs

- Hidden-row toggle can confuse summaries if hidden rows are grey but excluded -> table copy and styling must clearly distinguish visible vs hidden-by-label rows.
- Fetching broad rows for hidden display can increase response size for label-narrowed views -> only broaden when hidden-row toggle is enabled.
- Controllability filter must consistently apply across table, KPI cards, spending bars, and net trend -> cover backend and frontend tests for each affected data path.

## Migration Plan

No data migration required. Existing dashboard filter storage can remain compatible; if controllability or hidden-row preferences are persisted, use new storage keys with defaults of `both` and hidden rows off.

## Open Questions

- None.
