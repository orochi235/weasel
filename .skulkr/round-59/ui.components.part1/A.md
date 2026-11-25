I couldn't write `.skulkr/out/findings.md` (write permission was denied), so here is the whole findings document:

# Audit round 59 — ui.components.part1

## ColorChip drops a pick whose input and change arrive in one task
- where: packages/ui/src/components/ColorField/ColorChip.tsx:41 (ColorChip, `commit`)
- scenario: `commit` reads `draft` from the last render. Sometimes the picker's `input` and its closing `change` fire in the same task, with no render in between. Then `onInput` has only queued `setDraft`, so the native `change` listener (`usePickerClose` → latest `commit`) sees `draft === null` and returns. `onChange` never runs and the pick is neither committed nor recorded. The next render shows a draft that nothing commits until a blur. ColorField's opacity path had exactly this bug, fixed in 471aac9450 ("the guard read alphaDraft from the render before setAlphaDraft landed"), and the chip still has it. Keep the draft in a ref beside the state and commit from that.
- evidence: read
- severity: medium

## A Checkbox disabled for a reason draws its box as enabled
- where: packages/ui/src/components/Checkbox/box.module.css:23,55 (`.checkbox:hover:not(:disabled)`, `.checkbox:disabled`); packages/ui/src/components/Checkbox/Checkbox.tsx:96
- scenario: take `<Checkbox disabled disabledReason="Locked">Snap</Checkbox>`, or a checkbox under a `Disabled` scope with a reason. `useNativeHold` keeps it reachable: the input gets `aria-disabled`/`data-disabled` rather than native `disabled`, and Checkbox then removes `data-disabled` from the input. The box skin dims only on `:disabled`. So the box draws at full opacity, keeps the pointer cursor and the hover border, and only the label text dims. A checkbox with no label inside a `Field` shows no disabled state at all. It should dim on `:is(:disabled, [aria-disabled='true'])`, as ActionButton's and Button's skins do.
- evidence: read
- severity: medium

## CheckboxGroup drawn as switches shows a mixed value as off
- where: packages/ui/src/components/CheckboxGroup/CheckboxGroup.tsx:67-68 (CheckboxGroup)
- scenario: take `<CheckboxGroup control="switch" mixedValues={['text']} …/>`. `model.stateOf(i)` returns `'mixed'`, but only the checkbox path passes `indeterminate`. The switch gets `isSelected={false}` and nothing else, since Switch has no mixed prop. A mixed item therefore looks and announces the same as an off one. The `SwitchRow` story's blurb ("one disabled and one mixed") describes a mixed switch that never gets drawn.
- evidence: read
- severity: medium

## Turning CheckboxGroup's `sweep` on or off remounts every box
- where: packages/ui/src/components/CheckboxGroup/CheckboxGroup.tsx:81-87 (CheckboxGroup)
- scenario: without `sweep` the root is the scope element `holdScope(...)` returns. With `sweep` it is a Fragment holding that element and a `SegmentSweeper`. Toggling `sweep` changes the root's type, so React unmounts and remounts the whole group: the focused box loses focus and any uncontrolled state inside resets. `ButtonTooltip` and `holdScope` both keep a fixed wrapper shape to avoid exactly this.
- evidence: read
- severity: low

## ActionSettingsPopover stays open and editable when a Disabled scope disables its action
- where: packages/ui/src/components/ActionSettings/ActionSettingsPopover.tsx:26 (ActionSettingsPopover)
- scenario: `available` reads only the button's own `disabled` prop. Open the popover, then put it under a `<Disabled>` scope (or have its bar become one). ActionButton, through `useDisabled`, shows the button disabled, but `available` stays true. The form stays open, and the rule that closes it for good when its action goes away never runs. It should read `useDisabled(button).disabled`, as the button does.
- evidence: read
- severity: low

## useActionStates' post-commit recheck ignores a changed disabledReason
- where: packages/ui/src/components/ActionBar/useActionStates.ts:47 (useActionStates)
- scenario: the layout-effect recheck covers a render that read a dep the same commit then published. It compares only `disabled` and `active`, while the store snapshot (line 40) also keys on `disabledReason`. If such a commit changes only the reason (still disabled, `SelectionRequired` → `Locked`), no recheck fires. The tooltip then keeps the stale reason until the next dep notice.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/ActionBar/ActionBar.stories.tsx
packages/ui/src/components/ActionBar/ActionBar.tsx
packages/ui/src/components/ActionBar/index.ts
packages/ui/src/components/ActionBar/reasonLabels.ts
packages/ui/src/components/ActionBar/useActionStates.ts
packages/ui/src/components/ActionButton/ActionButton.module.css
packages/ui/src/components/ActionButton/ActionButton.stories.tsx
packages/ui/src/components/ActionButton/ActionButton.tsx
packages/ui/src/components/ActionButton/controlForm.tsx
packages/ui/src/components/ActionButton/index.ts
packages/ui/src/components/ActionButton/usePreviewWhileNear.ts
packages/ui/src/components/ActionEdit/index.ts
packages/ui/src/components/ActionEdit/useActionEdit.ts
packages/ui/src/components/ActionSettings/ActionSettings.module.css
packages/ui/src/components/ActionSettings/ActionSettingsPopover.tsx
packages/ui/src/components/ActionSettings/index.ts
packages/ui/src/components/ActionSettings/useActionSettings.ts
packages/ui/src/components/Callout/Callout.module.css
packages/ui/src/components/Callout/Callout.stories.tsx
packages/ui/src/components/Callout/Callout.tsx
packages/ui/src/components/Callout/CalloutBody.tsx
packages/ui/src/components/Callout/index.ts
packages/ui/src/components/Callout/rectAnchor.tsx
packages/ui/src/components/Callout/useEscapeDismissal.ts
packages/ui/src/components/Caret.tsx
packages/ui/src/components/Checkbox/Checkbox.module.css
packages/ui/src/components/Checkbox/Checkbox.stories.tsx
packages/ui/src/components/Checkbox/Checkbox.tsx
packages/ui/src/components/Checkbox/box.module.css
packages/ui/src/components/Checkbox/index.ts
packages/ui/src/components/CheckboxGroup/CheckboxGroup.module.css
packages/ui/src/components/CheckboxGroup/CheckboxGroup.stories.tsx
packages/ui/src/components/CheckboxGroup/CheckboxGroup.tsx
packages/ui/src/components/CheckboxGroup/index.ts
packages/ui/src/components/Code/Code.module.css
packages/ui/src/components/Code/Code.stories.module.css
packages/ui/src/components/Code/Code.stories.tsx
packages/ui/src/components/Code/Code.tsx
packages/ui/src/components/Code/index.ts
packages/ui/src/components/Code/variantIcons.ts
packages/ui/src/components/CodeBlock/CodeBlock.module.css
packages/ui/src/components/CodeBlock/CodeBlock.stories.tsx
packages/ui/src/components/CodeBlock/CodeBlock.tsx
packages/ui/src/components/CodeBlock/index.ts
packages/ui/src/components/ColorField/ColorChip.tsx
packages/ui/src/components/ColorField/ColorField.module.css

<!-- done: 6 findings, files read: 46 -->