## A number row on a `readout` leaf draws its value as read-only, so the compared number cannot be set
- where: packages/prefs-editor/src/PrefConditionEditor/ConditionRow.tsx:46 (ValueControl)
- scenario: a schema holds `progress: { kind: 'number', readout: true, … }` (a value the app shows but the user does not edit; `conditionLeaves` offers it, since `prefHoldsValue` is true). Add a condition on it: `rowAt` → `withComparison` writes `{ path: 'progress', above: 0 }`. ValueControl builds the control with `prefFieldProps(leaf, …)`, which spreads `readOnly: true` for any leaf with `readout === true` (packages/ui/src/components/Prefs/prefField.tsx:70), and `PropertyControl` then draws an `<output>` rather than an input. The author can never change the 0, so `showIf: progress above 50` cannot be written in the editor. The readout flag describes the pref's own form control, not the condition's comparand; ValueControl should drop `readOnly` (and `disabled`) from the field it borrows.
- evidence: read
- severity: medium

## `exclude` never reaches an entry's fields, so a field of a list/map entry is offered a condition on its own value
- where: packages/prefs-editor/src/PrefConditionEditor/PrefConditionEditor.tsx:69 (prefOptions filter)
- scenario: list `layers` whose `item` is an object `{ visible, opacity }`; select the `opacity` field in PrefSchemaEditor. `conditionRenderer` passes `entryOf = within` (the list) and `exclude = ownPaths` (root value paths). The filter keeps every leaf with `from === 'item'` unconditionally (`found.from === 'item' || …`), so the picker for opacity's `showIf` offers "this entry: opacity", a condition on its own value — exactly what the `exclude` doc says the pickers leave out ("which cannot sensibly be shown or enabled by its own value"). `exclude` has no way to name an entry-relative path, and the item-side leaves bypass it, so for a node inside an entry the documented exclusion silently does not happen.
- evidence: read
- severity: medium

## The clipboard's status message is never cleared, so "Copied." / "The clipboard holds no condition." outlives the state it described
- where: packages/prefs-editor/src/PrefConditionEditor/ConditionClipboard.tsx:16 (ConditionClipboard `said`)
- scenario: press Paste with junk on the clipboard → "The clipboard holds no condition."; then build the condition by hand with the rows (or press Copy, then edit the condition so the clipboard no longer matches it). The status stays on the editor's first line indefinitely, since only another Copy/Paste press changes `said`; nothing resets it on edit or after a delay. A stale "Copied." beside a condition that has since changed reports something no longer true.
- evidence: read
- severity: low

## Files read
packages/prefs-editor/src/PrefConditionEditor/ConditionClipboard.tsx
packages/prefs-editor/src/PrefConditionEditor/ConditionGroupRows.tsx
packages/prefs-editor/src/PrefConditionEditor/ConditionRow.tsx
packages/prefs-editor/src/PrefConditionEditor/PrefConditionEditor.module.css
packages/prefs-editor/src/PrefConditionEditor/PrefConditionEditor.stories.module.css
packages/prefs-editor/src/PrefConditionEditor/PrefConditionEditor.stories.tsx
packages/prefs-editor/src/PrefConditionEditor/PrefConditionEditor.tsx
packages/prefs-editor/src/icons.gen.ts
packages/prefs-editor/src/index.ts
packages/prefs-editor/src/testing/prefSchemaEditor.ts

<!-- done: 3 findings, files read: 10 -->
