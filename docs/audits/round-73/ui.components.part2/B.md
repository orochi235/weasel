# Audit round 73 — ui.components.part2

## ComboBox never shows `errorLabel` when a failed load leaves the previous rows in place
- where: packages/ui/src/components/ComboBox/ComboBox.tsx:169 (ComboBox, `renderEmptyState`)
- scenario: `useAsyncOptions` keeps the last resolved list on a rejected load (useAsyncOptions.ts:87-91 sets only `loadError` and `loading=false`, never `setOptions([])`). Type "300" (5 rows load), then the network drops and "3001" rejects: `options` still holds the five stale rows, `loading` is false, so the busy spinner goes too. ComboBox only shows `errorLabel` inside `renderEmptyState`, which never runs on a non-empty collection. The user sees the stale rows as if they were the answer to "3001", with no error anywhere, contrary to the `loadError` doc ("A failed load, shown as `errorLabel` rather than as an empty corpus"). The error should be shown whenever `loadError` is set, not only when the list is empty.
- evidence: read
- severity: medium

## CycleButton with a `value` not in `options` names option 0 as current and a click skips it
- where: packages/ui/src/components/CycleButton/CycleButton.tsx:51 (CycleButtonInner)
- scenario: `options` = [rect, ellipse, star], `value` = 'polygon' (a stale or out-of-set value). `findIndex` returns -1, clamped to 0, so the button draws rect's icon and announces "Shape: Rectangle — click for Ellipse", though rect is not current; a click calls `onChange('ellipse')`, so Rectangle can never be reached by a plain click from this state, and shift-click goes to star. The face and name misstate the value, and the first stop of the rotation is skipped.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/ColorField/ColorField.stories.tsx
packages/ui/src/components/ColorField/ColorField.tsx
packages/ui/src/components/ColorField/index.ts
packages/ui/src/components/ColorField/usePickerClose.ts
packages/ui/src/components/ColorModeControl/ColorModeControl.stories.module.css
packages/ui/src/components/ColorModeControl/ColorModeControl.stories.tsx
packages/ui/src/components/ColorModeControl/ColorModeControl.tsx
packages/ui/src/components/ColorModeControl/colorModes.ts
packages/ui/src/components/ColorModeControl/index.ts
packages/ui/src/components/ComboBox/ComboBox.module.css
packages/ui/src/components/ComboBox/ComboBox.stories.module.css
packages/ui/src/components/ComboBox/ComboBox.stories.tsx
packages/ui/src/components/ComboBox/ComboBox.tsx
packages/ui/src/components/ComboBox/index.ts
packages/ui/src/components/CommandPalette/CommandPalette.module.css
packages/ui/src/components/CommandPalette/CommandPalette.stories.tsx
packages/ui/src/components/CommandPalette/CommandPalette.tsx
packages/ui/src/components/CommandPalette/index.ts
packages/ui/src/components/CommandPalette/selectionSummary.ts
packages/ui/src/components/CommandPalette/usePaletteItems.ts
packages/ui/src/components/ControlSize/ControlSize.stories.module.css
packages/ui/src/components/ControlSize/ControlSize.stories.tsx
packages/ui/src/components/ControlSize/ControlSize.tsx
packages/ui/src/components/ControlSize/index.ts
packages/ui/src/components/CycleButton/CycleButton.stories.module.css
packages/ui/src/components/CycleButton/CycleButton.stories.tsx
packages/ui/src/components/CycleButton/CycleButton.tsx
packages/ui/src/components/CycleButton/index.ts
packages/ui/src/components/DataGrid/DataGrid.module.css
packages/ui/src/components/DataGrid/DataGrid.stories.module.css
packages/ui/src/components/DataGrid/DataGrid.stories.tsx
packages/ui/src/components/DataGrid/DataGrid.tsx
packages/ui/src/components/DataGrid/DataGridHead.tsx
packages/ui/src/components/DataGrid/DataGridRow.tsx
packages/ui/src/components/DataGrid/index.ts
packages/ui/src/components/DataGrid/rowSort.ts
packages/ui/src/components/DetailList/DetailList.module.css
packages/ui/src/components/DetailList/DetailList.stories.module.css
packages/ui/src/components/DetailList/DetailList.stories.tsx
packages/ui/src/components/DetailList/DetailList.tsx
packages/ui/src/components/DetailList/index.ts
packages/ui/src/components/Dialog/ContainedModal.tsx
packages/ui/src/components/Dialog/Dialog.module.css
packages/ui/src/components/Dialog/Dialog.stories.tsx
packages/ui/src/components/Dialog/Dialog.tsx
packages/ui/src/components/Dialog/index.ts

<!-- done: 2 findings, files read: 46 -->
