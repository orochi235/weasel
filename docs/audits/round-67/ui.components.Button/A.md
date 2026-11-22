# Audit round 67 — ui.components.Button

## A pressed confirm button is never dimmed: its rule's selector contradicts itself
- where: packages/ui/src/components/Button/Button.module.css:299-300 (`.variant_solid[data-stance='confirm'] … .pressed` rule)
- scenario: `<Button stance="confirm" pressed>` → the selector reads `.variant_solid[data-stance='confirm'].pressed:not(:disabled, [data-disabled]):not(:where(.variant_solid[data-stance='confirm']))`, which demands the element both be and not be a confirm button, so it matches nothing. The pressed confirm toggle keeps its accent body (the rule above now excludes it) but gets no `brightness(0.92)`, so it looks identical to an unpressed one; the comment at line 292 promises "the rule after this dims it instead". Commit 2abe42c22e pasted the new comment and `:not(:where(…))` into this rule as well as the one above (`git log -L`); the selector should be `.variant_solid[data-stance='confirm'].pressed:not(:disabled, [data-disabled])`.
- evidence: read (selector and `git log -L 292,300` diff)
- severity: medium

## Pressing an aria-disabled solid button still dims its gloss
- where: packages/ui/src/components/Button/Button.module.css:183 and :234 (`:active::before` rules)
- scenario: `<Button disabled disabledReason="…">` gets `aria-disabled` + `data-disabled` and stays non-native-disabled (`stillReachable` in Tooltip/buttonTooltip.tsx), so `:active` matches on press. The body rules (lines 167, 222) exclude `[data-disabled]` and leave the body alone, but `.variant_solid:active:not([data-readonly])::before` and the confirm one exclude only `[data-readonly]`, so the specular gloss drops to 0.2/0.3 opacity: a disabled button still shows a half-press. Both should carry the same `:not(:disabled, [data-disabled], [data-readonly])` as their body rules.
- evidence: read
- severity: low

## Button Lab's radius, pad-x and weight knobs do nothing on the segmented target
- where: packages/ui/src/components/Button/lab/buttonLabConfig.ts:59-63 (`buttonVarsOf`); packages/ui/src/components/Button/lab/ButtonLabView.tsx:21-26 (`Target`)
- scenario: with Component = segmented (the default target), the shape group's Radius, Pad x and Weight knobs write `--wzl-button-radius`, `--wzl-button-pad-x` and `--wzl-button-font-weight` onto the wrapper, but `segmentedControl.module.css` reads none of the `--wzl-button-*` hooks (grep: only `--btn-*` and `--wzl-field-font-size`). Dragging them changes nothing on the preview, yet `exportDeltas` still emits them as deltas, so the exported rule claims a look the user never saw. The story blurb says the knobs tune "a button or a segmented bar".
- evidence: read (grep of Segmented CSS for `--wzl-button-`)
- severity: low

## Exported shape deltas pasted into `.button` force every size to the tuned md metrics
- where: packages/ui/src/components/Button/lab/buttonLabConfig.ts:87-96 (`exportDeltas`), :59-63
- scenario: tune Height to 32 and Font size to 16, click "Export deltas" → `.button { --wzl-button-h: 32px; --wzl-field-font-size: 16px; … }`, which the doc says to add to `Button.module.css`'s `.button` rule. `.size_xs` / `.size_sm` read `var(--wzl-button-h, …)` and `var(--wzl-button-pad-x, …)` first, and `.button` reads `--wzl-field-font-size` first, so `xs` and `sm` buttons become 32px/16px too, and the hooks themes use to size buttons are overridden by the component itself — the same hazard `PREVIEW_ONLY` guards against for `--wzl-accent`/`--wzl-gloss`, left open for the `--wzl-button-*`/`--wzl-field-font-size` keys.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/Button/Button.close.stories.module.css
packages/ui/src/components/Button/Button.close.stories.tsx
packages/ui/src/components/Button/Button.module.css
packages/ui/src/components/Button/Button.native.stories.module.css
packages/ui/src/components/Button/Button.native.stories.tsx
packages/ui/src/components/Button/Button.stories.module.css
packages/ui/src/components/Button/Button.stories.tsx
packages/ui/src/components/Button/Button.tsx
packages/ui/src/components/Button/closeButtonProps.tsx
packages/ui/src/components/Button/index.ts
packages/ui/src/components/Button/lab/ButtonLab.stories.module.css
packages/ui/src/components/Button/lab/ButtonLab.stories.tsx
packages/ui/src/components/Button/lab/ButtonLabView.tsx
packages/ui/src/components/Button/lab/buttonLabConfig.ts
packages/ui/src/components/Button/variantIcons.ts

<!-- done: 4 findings, files read: 15 -->
