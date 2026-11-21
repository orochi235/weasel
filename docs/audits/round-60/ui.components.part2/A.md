I couldn't write `.skulkr/out/findings.md` because the write permission was declined, so the whole document is below.

# Audit round 60: ui.components.part2, blind reviewer findings

## ComboBox reports an Escape as an option commit when `selectedKey` and `inputValue` are both controlled
- where: packages/ui/src/components/ComboBox/ComboBox.tsx:142 (`ComboBox` `onSelectionChange`), :215 (`ComboBoxFrame` `onKeyDownCapture`)
- scenario: a ComboBox has a controlled `selectedKey="a"` and a controlled `inputValue`. The user types, then presses Escape. React Aria's Escape handler calls `state.revert()`, which runs `commitSelection()`. With both props controlled, that calls `onSelectionChange(selectedKey)` so the parent can revert. This is the same path the code already guards with `revertingRef` for blur and for an Enter with no option highlighted. Escape never sets `revertingRef`, so `onCommit({ source: 'option', key: 'a' })` fires for a key nobody picked. It should be treated as a revert and commit nothing.
- evidence: read for ComboBox.tsx. React Aria's revert path is inferred from its source as I know it; the tree has no node_modules to confirm the version.
- severity: medium

## A stacked ContainedModal loses its inert background when the modal under it closes first
- where: packages/ui/src/components/Dialog/ContainedModal.tsx:51-65 (`inertOutside`), :84-87
- scenario: contained Dialog A is open, so `root`'s other children are made inert and recorded by A. Contained Dialog B then opens. Its `inertOutside` skips those children because they already have `inert`, and records only A's overlay. If A then closes while B stays open (A closing itself after it opens a confirm, or a host closing it), A's undo removes `inert` from the page content. B is still showing as modal, but everything behind it in `root` is clickable and readable by screen readers again. Each modal should own its own count of `inert`, or skip only what it did not set.
- evidence: read
- severity: medium

## `DetailList` with `layout="block"` and `values="figures"` draws inline
- where: packages/ui/src/components/DetailList/DetailList.module.css:10-12, :67-69
- scenario: `.list[data-layout='block']` (one track) and `.list[data-values='figures']` (two tracks) have the same specificity, 0,2,0. The figures rule comes later and wins. A `<DetailList layout="block" values="figures">` therefore gets two columns, and each subgrid row puts its label beside its value instead of above it. That is the narrow-column case `block` exists for. It should stay one column.
- evidence: read
- severity: low

## DataGrid's empty-state cell and disclosure column lose their alignment and padding to `.table th/td`
- where: packages/ui/src/components/DataGrid/DataGrid.module.css:14-19, :54-59, :104-109
- scenario: `.table th, .table td` (0,1,1) sets `text-align: left` and `padding: 3px …`. It outranks `.empty` (0,1,0), so the empty "—" is left-aligned with 3px padding instead of being centered with `--wzl-space-4` padding. It also outranks `.detailCol, .detailCell` (0,1,0), so their `padding-inline: 0` and `text-align: center` are dropped. The disclosure therefore sits left-aligned with inline padding in a `--wzl-control-h-sm`-wide column. Only `.table .detailCell { padding-block: 0 }` takes effect.
- evidence: read
- severity: low

## Dialog's contained path silently drops most `ModalOverlay` props
- where: packages/ui/src/components/Dialog/Dialog.tsx:118-136
- scenario: `DialogProps` takes React Aria's `ModalOverlayProps`, and the portal path spreads `rest` onto `ModalOverlay`. The contained path, used when the portal target is a contained root, forwards only `defaultOpen` and `shouldCloseOnInteractOutside`. A caller's `style`, `isEntering`/`isExiting` or other overlay props work in one host and are ignored in the other with no warning.
- evidence: read
- severity: low

## Dialog's `Basic` story tells the reader to click outside to close, but the story is not `dismissable`
- where: packages/ui/src/components/Dialog/Dialog.stories.tsx:32
- scenario: the body text says "Try Escape, the close button, or clicking outside." `dismissable` defaults to false and the story never sets it, so clicking outside does nothing. Either the text or the story's args are wrong.
- evidence: read
- severity: low

## ComboBox fires no `onCommit` when the user picks the option that is already selected
- where: packages/ui/src/components/ComboBox/ComboBox.tsx:142-145
- scenario: `onCommit` is documented to fire on Enter on the highlighted option or a click on one, but it is driven only from `onSelectionChange`. When `selectedKey` is uncontrolled, or controlled without `inputValue`, choosing the current option again (clicking the checked row, or Enter on it) does not call `onSelectionChange`, because the key did not change. `onCommit` never fires, so a jump or command box gets nothing on a second pick of the same option.
- evidence: read for ComboBox.tsx. That React Aria skips `onChange` for an equal value is inferred.
- severity: low

## CycleButton throws on an empty `options`
- where: packages/ui/src/components/CycleButton/CycleButton.tsx:48-53 (`CycleButtonInner`)
- scenario: with `options={[]}`, for example a filtered list that comes out empty, `current` is `options[0]`, which is `undefined`. `current.label` then throws a TypeError during render. The type allows any readonly array. The button should render held or empty rather than crash.
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

<!-- done: 8 findings, files read: 46 -->