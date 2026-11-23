# Audit 74 — ui.components.part2 (reviewer findings)

## ComboBox's `loadError` is never shown under the default filter when the failed load leaves no options
- where: packages/ui/src/components/ComboBox/ComboBox.tsx:142 (ComboBox, `allowsEmptyCollection`) and :160 (error row)
- scenario: an async consumer keeps the default `filter='contains'` (it only sets `options`/`loading`/`loadError`), and the load rejects, so `options` is `[]`. `allowsEmptyCollection` is `false` unless `filter === 'none'`, so React Aria will not open (or closes) the popover on an empty collection, and the `role="alert"` `errorLabel` row inside the popover is never rendered. The prop doc promises `errorLabel` "above whatever options are left, and in place of `emptyLabel`"; only `filter='none'` gets that. Should keep the popover open while `loadError` is set (e.g. `allowsEmptyCollection ?? (filter === 'none' || loadError !== null)`).
- evidence: read (React Aria's empty-collection close behavior inferred from its documented `allowsEmptyCollection`)
- severity: medium

## The loading spinner becomes a third grid item under `width="fit"` and adds a row to the field
- where: packages/ui/src/components/ComboBox/ComboBox.module.css:13 (`.frame:has(input[aria-busy='true'])::after`) with :84 (`.fit .frame`)
- scenario: `width="fit"` makes `.frame` a two-column grid whose items are placed explicitly (input and sizer at 1/1, button at 1/2). While `loading`, the `::after` spinner is an unplaced grid item, so auto-placement puts it in row 2, column 1: the field grows a second row (spinner height plus nothing beside it) for every request and collapses again when it lands, shifting whatever is below. The flex (`fill`) path puts it inline after the button as intended. Needs a placement for the fit grid (e.g. its own column, or `grid-area: 1 / 1` with `justify-self: end`).
- evidence: read (CSS grid auto-placement reasoning; not rendered)
- severity: low

## The dialog overlay's fade-in never runs: the entering state is already fully opaque
- where: packages/ui/src/components/Dialog/Dialog.module.css:17 (`.overlay[data-entering][data-rac]`)
- scenario: React Aria's `ModalOverlay` mounts with `data-entering` and `data-rac`. `.overlay[data-entering]` sets `opacity: 0`, but the more specific `.overlay[data-entering][data-rac]` immediately sets `opacity: 1`, and the settled state (`:not([data-entering]):not([data-exiting])`) is also 1. The first computed style is therefore 1, so the `transition: opacity` declared on `.overlay` has nothing to animate from and the scrim pops in; only the exit (`[data-exiting]` → 0) fades. The `[data-entering]` rule is dead. Either the intended start state is 0 (drop the `[data-rac]` override) or the transition/entering rules are vestigial.
- evidence: read (specificity reasoning; history shows the rules unchanged since the primitive was added)
- severity: low

## A grid sorted by a non-sortable column shows the sort arrow but no `aria-sort`
- where: packages/ui/src/components/DataGrid/DataGridHead.tsx:28 (DataGridHead)
- scenario: `defaultSort={{ columnId: 'cands', direction: 'asc' }}` on a column with `sortable: false`. `sortedRows` sorts by it and the header draws ` ↑` and `.sortActive`, but `aria-sort` is computed only when `sortable`, so assistive tech is told no column is sorted while sighted users see one. The visual and the ARIA answer the same question two ways; `aria-sort` should follow `active`, not `sortable`.
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
