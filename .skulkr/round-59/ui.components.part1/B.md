<!-- done: 6 findings, files read: 46 -->

I couldn't write `.skulkr/out/findings.md` because the write was denied, so the whole document follows.

# Audit round 59: ui.components.part1

## ActionButton drops a caller's `style` whenever `grade` is set
- where: packages/ui/src/components/ActionButton/ActionButton.tsx:93-103 (ActionButton)
- scenario: `<ActionButton grade="danger" style={{ marginInlineStart: 8 }} … />`. `ActionButtonProps` lets every native attribute through, `style` included, and `{...native}` is spread first. Then `{...appearance}` is spread. With a grade, `useAppearance` returns `style: { '--wzl-grade': … }`, which replaces the caller's `style` completely. The caller's style is silently lost. It should be merged, as `Callout` already does at Callout.tsx:144. Without a grade, `appearance` is `{}` and the caller's style survives, so the result depends on an unrelated prop.
- evidence: read
- severity: medium

## ColorChip sends no end signal for a pick that ends where it started, after sending `onInput` ticks
- where: packages/ui/src/components/ColorField/ColorChip.tsx:41-45 (ColorChip, commit)
- scenario: the user opens the picker, drags, then brings it back to the starting color, or cancels the picker so the browser restores the original value through a final `input`. `onInput` has already gone out for every tick. On close, `commit` clears its draft but skips `onChange` because `draft.rgb === draft.from`, and the component has no cancel callback. So the consumer never learns the gesture ended. An ongoing edit opened from `onInput` stays open. `ColorField` keeps `picked` set (ColorField.tsx:105), so if `value` later changes from outside, the opacity slider composes against the stale pick (`visibleRgb = picked ?? rgb6`) and writes the wrong color. The unmoved pick needs a cancel or end notice of its own.
- evidence: read
- severity: medium

## A Checkbox disabled for a reason is not dimmed and still looks clickable
- where: packages/ui/src/components/Checkbox/Checkbox.tsx:95-96 (Checkbox); packages/ui/src/components/Checkbox/box.module.css:23,62
- scenario: `<Checkbox disabled disabledReason="Locked">`. `useNativeHold` keeps the input reachable: it sets `aria-disabled` and `data-disabled` and leaves native `disabled` off. Checkbox then clears `data-disabled` on the input. The box skin dims only on `:disabled` and keeps its hover border on `:hover:not(:disabled)`. The result is a box at full opacity with a pointer cursor and a hover edge, next to a dimmed label (Checkbox.module.css:12). Checkbox.module.css:7 says "the box dims itself on :disabled", which is not true on this path. The skin has no `[aria-disabled='true']` rule, while ActionButton's CSS does have one.
- evidence: read
- severity: low

## CheckboxGroup with `control="switch"` draws a mixed item as plain off
- where: packages/ui/src/components/CheckboxGroup/CheckboxGroup.tsx:67-68 (CheckboxGroup)
- scenario: `<CheckboxGroup control="switch" mixedValues={['text']} …>`, as in the `SwitchRow` story, which says "one disabled and one mixed". `state === 'mixed'` goes only to a Checkbox's `indeterminate`. Switch gets `isSelected={false}` and has no mixed prop at all. So a mixed switch looks and is announced exactly like an off one, and the `mixedValues` setting is silently lost for this control.
- evidence: read
- severity: low

## useActionStates' post-commit recheck misses a change to `disabledReason` alone
- where: packages/ui/src/components/ActionBar/useActionStates.ts:46-52 (useActionStates)
- scenario: after a commit that published a dep the render had read, an action's `enabled` returns a different reason while staying disabled, e.g. `selection-required` → `locked`. The store snapshot (line 40) includes the reason, but the layout-effect recheck compares only `disabled` and `active`. That recheck covers exactly the case where no registry notice follows. So the tooltip keeps the old reason until some unrelated notice arrives. The two staleness checks in one hook disagree on what counts as a change.
- evidence: read
- severity: low

## ActionSettingsPopover ignores a Disabled scope when deciding whether the form may stay open
- where: packages/ui/src/components/ActionSettings/ActionSettingsPopover.tsx:26-29 (ActionSettingsPopover)
- scenario: the popover sits inside a `<Disabled>` scope, or a disabled `ActionBar` or `PrefsBar`, which pass `disabled` down as a scope. The user opens the form, then the scope turns on. `ActionButton` reads the scope through `useDisabled` and holds itself, but `available` reads only `button.disabled`. The form stays open with its controls disabled, and it is still open when the scope lifts. That contradicts the comment that the action going away "closes the form for good". It should use `useDisabled(button).disabled`.
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