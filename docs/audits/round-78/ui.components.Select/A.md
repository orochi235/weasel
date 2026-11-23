# Audit round 78: ui.components.Select

## Select's option body and note are defined twice, and ComboBox's copy has drifted (no `min-width: 0`)
- where: packages/ui/src/components/Select/Select.module.css:147 (`.optionBody`, `.note`); packages/ui/src/components/Select/listbox.module.css:34 (`.optionBody`, `.note`)
- scenario: `listbox.module.css` is the shared row stylesheet for Select and ComboBox (`.option` is composed from it), but Select draws its rows with its own `.optionBody` (`min-width: 0`) and `.note` (`display: block`), while ComboBox (ComboBox.tsx:302–304) uses listbox's `.optionBody`, which lacks `min-width: 0`. A ComboBox row with a description and a long label then sizes that flex item to its content instead of letting it shrink, so the row overflows the list (which scrolls sideways) where the same row in a Select shrinks. One decision is answered in two places, and the two answers already differ. Select should compose listbox's classes, or listbox's should carry `min-width: 0`.
- evidence: read
- severity: low

## A `width='fit'` select whose key isn't among its options shows a placeholder its sizer never measured
- where: packages/ui/src/components/Select/Select.tsx:173 (`keepsHint`)
- scenario: the trigger shows React Aria's own placeholder whenever no row matches the key. But `ownHint` is reported to the sizer only when `shownKey == null`. With `width='fit'`, no `placeholder`, and a controlled `selectedKey` that names no option (a stale key, or options that haven't loaded yet), the trigger shows "Select an item" while the sizer holds only the option labels. If those labels are shorter than the placeholder, the trigger ellipsizes it, and the trigger widens later if the key gets cleared to `null`. `keepsHint` should follow what the trigger actually shows (the placeholder), not whether a key is null.
- evidence: read (React Aria showing its placeholder for a key that is in no row is inferred from how `SelectValue` resolves `selectedItem`)
- severity: low

## `variant='bare'` ignores the `--wzl-select-pad` and `--wzl-select-bg` hooks but honors `--wzl-select-border`
- where: packages/ui/src/components/Select/Select.module.css:64 (`.bare .trigger`)
- scenario: the `.trigger` comment says the hooks are how a surface restyles the visible box. On a bare select, `.bare .trigger` sets `padding: 0` and `background: transparent` outright (specificity 0,2,0 beats `.trigger`'s hook-driven padding and the frame's `--_frame-bg`). Its border, though, goes through `var(--wzl-select-border, …)`. A surface that sets `--wzl-select-pad` or `--wzl-select-bg` gets no effect on a bare select, while `--wzl-select-border` does reach it. One hook is honored and two are silently dropped on the same path.
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

<!-- done: 3 findings, files read: 11 -->
