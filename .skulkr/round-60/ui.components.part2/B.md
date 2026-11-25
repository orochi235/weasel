I couldn't write the rest to `.skulkr/out/findings.md`: permission was refused after the first two findings had gone in. So the whole document is below.

# Audit round 60: ui.components.part2, reviewer findings

Note: the frozen commit deaf03bd8ed407174fa289a1262d2699ffbe97db doesn't exist in this repository. I read the tree at HEAD 6f634fabe1 instead; none of the listed paths have local edits.

## `layout="block"` with `values="figures"` puts the label back beside the value
- where: packages/ui/src/components/DetailList/DetailList.module.css:67 (`.list[data-values='figures']`)
- scenario: `<DetailList layout="block" values="figures">`. `.list[data-layout='block']` (line 10) and `.list[data-values='figures']` (line 67) have the same specificity, (0,2,0), and the figures rule comes later, so it wins: `grid-template-columns` becomes `label-width minmax(min-content, 1fr)`. Each `.row` is a subgrid spanning `1 / -1`, so the `dt` lands in track 1 and the `dd` in track 2. The label sits beside the value instead of over it, the opposite of what `block` promises. The figures rule should exclude `[data-layout='block']`, as the container rules already do.
- evidence: read
- severity: medium

## Choosing the already-selected option again fires `onCommit` only when `selectedKey` and `inputValue` are both controlled
- where: packages/ui/src/components/ComboBox/ComboBox.tsx:142 (`onSelectionChange` → `onCommit`) and :224 (`ComboBoxFrame.onKeyDownCapture`)
- scenario: an option is selected, and the user highlights that same option and presses Enter. React Aria's `commit` sees the focused key is already selected and calls `commitSelection(true)`. That calls `props.onSelectionChange` only when both `selectedKey` and `inputValue` are controlled. So `onCommit({source:'option'})` fires in that case. Uncontrolled, or with only one of the two controlled, nothing fires; the AsyncOptions story's `useAsyncOptions` wiring controls `inputValue` alone. `onCommit`'s doc promises a commit on "Enter on the highlighted option" with no such condition. The capture handler already knows the focused key, so it could commit the option itself when that key is the selected one.
- evidence: read (React Aria `commit`/`commitSelection`, react-aria-components.js:6156-6182 in the vitest deps bundle)
- severity: medium

## The command palette's list turns into "No matching actions." while the dialog fades out
- where: packages/ui/src/components/CommandPalette/usePaletteItems.ts:31 (`allItems` memo), with CommandPalette.tsx:253
- scenario: the user runs an entry or presses Escape. `open` turns false, so `allItems` becomes `[]` and the body renders "No matching actions.". `ModalOverlay` stays mounted until its running animations finish, and that includes the `.overlay[data-exiting]` opacity transition (Dialog.module.css:21). So the fading box shows an empty-state message instead of the list the user just chose from.
- evidence: read (exit timing from react-aria-components.js:5246-5252)
- severity: low

## A contained `Dialog` ignores every `ModalOverlay` prop except `defaultOpen` and `shouldCloseOnInteractOutside`
- where: packages/ui/src/components/Dialog/Dialog.tsx:118-136 (contained branch)
- scenario: the portal branch spreads `...rest` onto `ModalOverlay` (line 144), so `style`, `isEntering` and `isExiting` reach it. Under a contained `portalContainer`, only `defaultOpen` and `shouldCloseOnInteractOutside` are passed on. So `<Dialog style={…}>` or a consumer-driven `isExiting` silently does nothing there. The same props give two different results depending on where the dialog portals.
- evidence: read
- severity: low

## `inertOutside` leaves content added to the root after the modal opens interactive
- where: packages/ui/src/components/Dialog/ContainedModal.tsx:84-87 (inert effect) and :51 (`inertOutside`)
- scenario: while a contained modal is open, a new child of `root` mounts, such as a remounted pane or a toast or popover portaled into the same container. The inert pass ran once over `root.children` as they were when the modal opened. The effect only reruns when `isOpen` or `root` changes. So the new sibling stays reachable by pointer and assistive tech behind the modal. Fixing it needs a `MutationObserver` on `root`'s child list while the modal is open, which is what React Aria's `ariaHideOutside` does.
- evidence: read
- severity: low

## Dialog's Basic story says clicking outside closes it, but it doesn't
- where: packages/ui/src/components/Dialog/Dialog.stories.tsx:32 (`Basic`)
- scenario: the story doesn't pass `dismissable`, which defaults to false (Dialog.tsx:25-26). A click on the scrim does nothing, yet the body text says "Try Escape, the close button, or clicking outside."
- evidence: read
- severity: low

## DataGrid sorts strings by UTF-16 code unit, and compares mixed string and number values inconsistently
- where: packages/ui/src/components/DataGrid/rowSort.ts:28-29 (`sortedRows`)
- scenario:
  - **Strings:** `['apple','Banana','cherry']` sorts ascending as `Banana, apple, cherry`, `['item10','item2']` sorts as `item10, item2`, and accented names sort after `z`.
  - **Mixed types:** an accessor returning `'—'` for some rows and numbers for others gives `'—' < 3` and `'—' > 3` both false. The comparator isn't transitive, so the resulting order depends on input order.
- evidence: read
- severity: low

## `CycleButton` throws on an empty `options`
- where: packages/ui/src/components/CycleButton/CycleButton.tsx:48-53 (`CycleButtonInner`)
- scenario: with `options={[]}`, `options[0]` is undefined, so `current.label` throws a `TypeError` during render.
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