## inertOutside inerts overlays already open when the modal opens, but leaves later ones alone
- where: packages/ui/src/components/Dialog/ContainedModal.tsx:70 (inertOutside)
- scenario: inside a contained root, a popover or toast (`data-weasel-overlay`) is already mounted when a ContainedModal opens → the initial sibling walk calls `hold(sibling)` with no overlay check, so it goes inert; the same overlay mounted a moment after the modal opens is skipped by the MutationObserver branch, which tests `data-weasel-overlay`. The docstring says overlays are left as they were. One decision, answered two ways depending on mount order.
- evidence: read
- severity: medium

## Selection summary's advice to use plural kind labels produces "pathses"
- where: packages/ui/src/components/CommandPalette/selectionSummary.ts:1 (pluralize)
- scenario: the comment tells consumers wanting an exact form to rename kind labels to `'paths'`; with kinds all `'paths'` and 3 selected, `/(s|…)$/` matches and the footer reads "3 pathses selected", and with 1 selected "1 paths selected". The documented workaround does not work against the code.
- evidence: read
- severity: low

## Row activation fires on clicks into ARIA-role controls the INTERACTIVE list omits
- where: packages/ui/src/components/DataGrid/DataGridRow.tsx:11 (INTERACTIVE / fromControl)
- scenario: a column renders a custom `role="checkbox"`, `role="switch"`, `role="link"`, `role="tab"` or `role="menuitem"` control (or any `[tabindex]` widget) → clicking it toggles it and also calls `onRowClick`, against the `onRowClick` doc ("clicks … landing on a control inside a cell … are left to that control"). Only native elements and `role="button"` are recognized.
- evidence: read
- severity: low

## Detail-row ids built from raw row ids break `aria-controls` when an id holds whitespace
- where: packages/ui/src/components/DataGrid/DataGrid.tsx:131 (DataGrid, detail id)
- scenario: a row with `id: 'route 1'` → the detail `<tr id="…-detail-route 1">`, and the Disclosure's `aria-controls` is an IDREF list, so it names two ids, neither of which exists. The disclosure loses its controlled-region link for any row id with a space.
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

<!-- done: 4 findings, files read: 46 -->
