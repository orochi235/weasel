## ComboBox: clicking the already-selected option commits nothing, while Enter on it commits
- where: packages/ui/src/components/ComboBox/ComboBox.tsx:136 (ComboBox `onSelectionChange`) and :217 (ComboBoxFrame `onKeyDownCapture` repick path)
- scenario: uncontrolled (or `selectedKey`-only controlled) ComboBox with `onCommit`, option "Red" selected. User opens the list and clicks "Red". React Aria's `useControlledState` reports no selection change for the same key, so `onSelectionChange` never runs and `onCommit` never fires. Pressing Enter on the same highlighted row does fire `onCommit({source:'option'})` through `repickRef`/`reverted()`. The `onCommit` docs promise a commit for "Enter on the highlighted option, a click on one"; the repick path only covers the keyboard, so the same gesture by pointer is dropped. Should commit on a click repick too (e.g. a press handler on the item, or the same repick bookkeeping on pointer selection).
- evidence: read (the click half is inferred from React Aria's controlled-state behavior, which the `repickRef` comment itself describes: "React Aria reports that only when both `selectedKey` and `inputValue` are controlled")
- severity: medium

## ColorField: a color pick on a mixed/unset field writes opacity 100% over every target's own alpha
- where: packages/ui/src/components/ColorField/ColorField.tsx:103-110 (ColorChip `onInput`/`onChange` composing with `visibleAlpha`)
- scenario: `mixed` (or `unset`) with `alpha`, `value` omitted. `hex8Of('#000000')` makes `alpha01` 1, so `visibleAlpha` is 1. Picking a color emits `compose(rgb, 1)` = `#rrggbbff` through `onInput` and `onChange`. A multi-selection whose fills were all 50% opaque but differed in hue becomes fully opaque. The `mixed` doc locks the opacity slider precisely because composing against the placeholder writes a value nobody chose, yet the color path composes against the placeholder's alpha the same way. Should emit `#rrggbb` (no alpha component) for the first pick while the alpha is indeterminate, or otherwise not invent an alpha.
- evidence: read
- severity: low

## DataGridHead: a sort on a non-sortable column draws the arrow but gives no `aria-sort`
- where: packages/ui/src/components/DataGrid/DataGridHead.tsx:24-29
- scenario: `defaultSort={{ columnId: 'cands', direction: 'asc' }}` on a column with `sortable: false`. `sortedRows` sorts by it and the header shows " ↑", but `aria-sort` is `undefined` because it is gated on `sortable`. The visible state and the accessible state answer "is this column sorted" two ways; a screen reader user is told nothing is sorted. `aria-sort` should follow `active`, not `sortable`.
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

<!-- done: 3 findings, files read: 46 -->
