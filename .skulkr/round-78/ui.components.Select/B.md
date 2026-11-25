# Audit round 78 — ui.components.Select

## An end- or center-aligned list lands a described row's label off the trigger's value
- where: packages/ui/src/components/Select/alignOverTrigger.tsx:115 (AlignOverTrigger layout effect), with packages/ui/src/components/Select/Select.module.css:147 (`.optionBody`) and :160 (`[data-align='end'] .option`)
- scenario: `--wzl-select-align: right` (or `center`), and the selected option has a `description` (or `disabledReason`) that is wider than its label. `SelectItem` wraps that row in `.optionBody`, a column flexbox with the default `align-items: stretch`, so the `.optionLabel` box takes the note's width and its text sits at the box's start edge. The effect matches `row.right` (or the box's center) to the value's end edge, so the label text lands `noteWidth − labelWidth` (or half that) short of the trigger's text. The selected row should cover the value. Rows without a note are content-sized and line up, so only described rows are off. The note and label also stay start-aligned inside `.optionBody` while the row is pushed to the end, so a described row's labels don't follow the list's end alignment.
- evidence: read
- severity: medium

## The over-trigger clamp reads the layout viewport, while React Aria holds the list to the visual viewport
- where: packages/ui/src/components/Select/alignOverTrigger.tsx:107 (AlignOverTrigger, `view`)
- scenario: outside an overlay frame, `view.bottom` is `documentElement.clientHeight`. React Aria measures its container with `visualViewport` where one exists. On a mobile browser with the on-screen keyboard up, or while pinch-zoomed, the visual viewport is shorter than the layout viewport. `lowest` is then too large, and the `offset` lets the list run under the keyboard or off the visible area, where React Aria cannot pull it back because it does not clamp along the offset axis (the comment above says so). The clamp should use the same viewport React Aria uses.
- evidence: read (my knowledge of React Aria's `getContainerDimensions` comes from memory, not from reading its source in this tree)
- severity: low

## Only four of the props the types omit are dropped at run time
- where: packages/ui/src/components/Select/Select.tsx:157 (Select, runtime drop of `value`/`defaultValue`/`onChange`/`selectionMode`)
- scenario: `SelectProps` omits `isDisabled`, `isOpen`, `isInvalid` and `isRequired` from React Aria's props alongside the four that are dropped. The comment says the drop covers "a caller the types do not reach", but a JS caller (or a cast) passing `isDisabled` or `isOpen` still has it spread onto `RACSelect` through `rest`. `isDisabled` then disables the select outside the kit's hold logic (no `data-held`, no reason tooltip), and `isOpen` controls the list outside the `open` prop. The two lists answer the same question differently; the runtime drop should match the type's omit list.
- evidence: read
- severity: low

## Select and ComboBox style an option's body and note from two diverging copies
- where: packages/ui/src/components/Select/Select.module.css:147 (`.optionBody`, `.note`) vs packages/ui/src/components/Select/listbox.module.css:36
- scenario: `listbox.module.css` says it is the shared option-row stylesheet for Select and ComboBox, but Select's rows use their own `.optionBody` (with `min-width: 0`) and `.note` (with `display: block`), and only ComboBox uses the listbox ones. The copies have already drifted: without `min-width: 0` on `.optionBody`, a ComboBox row with a long label or note can't shrink below its content inside the flex row, so it overflows where the same Select row truncates.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Select/Select.fontOptions.stories.module.css
packages/ui/src/components/Select/Select.fontOptions.stories.tsx
packages/ui/src/components/Select/Select.module.css
packages/ui/src/components/Select/Select.stories.module.css
packages/ui/src/components/Select/Select.stories.tsx
packages/ui/src/components/Select/Select.tsx
packages/ui/src/components/Select/alignOverTrigger.tsx
packages/ui/src/components/Select/index.ts
packages/ui/src/components/Select/listbox.module.css
packages/ui/src/components/Select/optionLabels.tsx
packages/ui/src/components/Select/selectItem.tsx

<!-- done: 4 findings, files read: 11 -->
