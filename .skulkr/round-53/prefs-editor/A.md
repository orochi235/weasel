## A condition on a `readout` number pref draws its compared value as a read-only readout, so it cannot be edited
- where: packages/prefs-editor/src/PrefConditionEditor/ConditionRow.tsx:46 (ValueControl)
- scenario: schema has `pref.number('Size', 12, { readout: true })`; a row `{ path: 'size', atLeast: 4 }` (or one added from the picker, which starts at `above: 0`). `ValueControl` builds the value field with `prefFieldProps(leaf, …)`, which copies the leaf's `readout: true` onto the props as `readOnly` (packages/ui/src/components/Prefs/prefField.tsx:70); `PropertyControl` then renders `PropertyReadout` (packages/ui/src/components/Properties/fieldControls.tsx:28), so the threshold is stuck at whatever it started at. `readout` says the pref's own value is not user-set; it says nothing about the number a condition compares it with, which should always be typable. The same call also passes the leaf's `clearable` through as an `onClear` whose `setValue(undefined)` the row ignores, so a clear button shows and does nothing.
- evidence: read
- severity: medium

## A test read from its group (`from: 'group'`) is checked but never drawn: its row gets no comparison controls and its picker names it as a root path
- where: packages/prefs-editor/src/PrefConditionEditor/ConditionRow.tsx:79 (ConditionRow), with ConditionGroupRows.tsx:56
- scenario: `PrefConditionEditor` takes `group` (added 2026-11-17) so `checkPrefCondition` can check `{ from: 'group', path: 'size', atLeast: 4 }`, and it reports no problem. But the row looks up its leaf with `conditionLeafOf(scope.leaves, test)`, which needs `l.from === test.from`, and `conditionLeaves` never yields a `from: 'group'` leaf. So `found` is undefined: the row shows only `is at least 4` as text, with no comparison or value control, and the pref picker gets a fallback option labelled `size` (`found?.leaf.name || test.path`), which reads as the root pref `size`. Re-pointing the row through the picker runs `rowAt` with a root leaf and quietly drops `from: 'group'`. A valid, checked test that the controls could draw (its leaf is `${group}.size`) should be drawn and keep its `from`.
- evidence: read
- severity: medium

## The clipboard's status message never clears, so "Copied." or "The clipboard holds no condition." stays up through later edits
- where: packages/prefs-editor/src/PrefConditionEditor/ConditionClipboard.tsx:14 (ConditionClipboard)
- scenario: press Copy → "Copied." is shown in a `role="status"`; then edit, add or remove rows. The message stays until the next Paste succeeds (the only `setSaid(null)`), so it claims the clipboard holds a condition that no longer matches what the editor shows. A failed paste's "holds no condition" likewise stays after the user goes on editing. Nothing resets `said` when `value` changes. (Paste's `catch` also reports a denied `readText` permission as "holds no condition", which is the wrong reason.)
- evidence: read
- severity: low

## A malformed condition gets no Paste, though Paste is the editor's way to replace a condition
- where: packages/prefs-editor/src/PrefConditionEditor/PrefConditionEditor.tsx:82 (PrefConditionEditor)
- scenario: `value` is something `isPrefCondition` rejects (e.g. a hand-edited `{ path: 1 }`). The early-return branch draws the JSON, Remove and the problems, but not `ConditionClipboard`, so the user cannot paste a good condition over the bad one; they must Remove first (which calls `onChange(undefined)`) and then paste. The component doc says Paste "replaces it with one read from there", without exception.
- evidence: read
- severity: low

## Rows are keyed by index, so removing a row hands its successor's controls the removed row's component state
- where: packages/prefs-editor/src/PrefConditionEditor/ConditionGroupRows.tsx:59 (ConditionGroupRows)
- scenario: rows A, B, C, where B's number value field has a half-typed draft or a nested group's add-Select is open; remove A. B is now rendered at key 0, the React instance that was A's, and C at key 1, B's old instance; any local state in `PropertyControl`'s number input (draft text, focus) or in `Select` moves to the wrong row. Index keys are also used for problems (`key={i}`), which is harmless there. Severity depends on how much local state the controls keep; I did not trace the number input's draft handling to confirm a visible symptom.
- evidence: read (symptom inferred, not run)
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

<!-- done: 5 findings, files read: 10 -->
