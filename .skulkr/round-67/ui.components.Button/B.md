# Audit round 67 — ui.components.Button

## A pressed confirm button gets no pressed treatment: the dimming rule's selector is a descendant selector that never matches
- where: packages/ui/src/components/Button/Button.module.css:299-300 (`.variant_solid[data-stance='confirm']/* … */ .pressed…` rule)
- scenario: `<Button stance="confirm" pressed>`. The rule at line 293 leaves confirm buttons out on purpose ("the rule after this dims it instead"). The rule after it has a comment pasted between its two compound selectors, followed by a newline. A comment is dropped, the newline stays, and the newline acts as a descendant combinator. The selector becomes `.variant_solid[data-stance='confirm'] .pressed:not(…):not(:where(.variant_solid[data-stance='confirm']))`, which matches a `.pressed` element *inside* a confirm button and never the button itself. So a held confirm toggle looks exactly like an unpressed one. Only `aria-pressed` shows its state; there is no `filter: brightness(0.92)`. It should read `.variant_solid[data-stance='confirm'].pressed:not(:disabled, [data-disabled]) { filter: brightness(0.92); }`. (The pasted comment and the copied `:not(:where(...confirm))` tail look like a bad merge of line 292-293 into this rule. If the tail were kept on a compound selector, it would also exclude the very element the rule is meant for.)
- evidence: read
- severity: medium

## The lab's exported deltas give every button size the same height and padding once pasted into `.button`
- where: packages/ui/src/components/Button/lab/buttonLabConfig.ts:60-62, 89-95 (`buttonVarsOf`, `exportDeltas`)
- scenario: In the lab, set Height to 32 and click "Export deltas". The output is `.button { --wzl-button-h: 32px; … }`, and its doc says to add it to `Button.module.css`'s `.button` rule. But each `.size_xs/.size_sm/.size_md` rule reads `var(--wzl-button-h, <size token>)` and `var(--wzl-button-pad-x, <size space>)` (Button.module.css:119-121). With the hook set on `.button`, all three sizes resolve to 32px and the same padding, and the icon-only width (`var(--btn-height)`) follows. Pasting the export therefore collapses xs/sm/md into one size instead of retuning md. The same goes for `--wzl-field-font-size` (it overrides every size's `--btn-fontsize`). The shape knobs either need to export as `.size_md`'s `--btn-*` values, or the doc needs to stop calling the output a `.button` rule.
- evidence: read
- severity: medium

## Pressing a soft-disabled (`data-disabled`) solid or confirm button still dims its gloss
- where: packages/ui/src/components/Button/Button.module.css:183, 234 (`:active::before` rules)
- scenario: `<Button disabled disabledReason="…">` is held as `aria-disabled` + `data-disabled` and stays a live, pressable element (buttonTooltip.tsx:46). Pressing it matches `.variant_solid:active:not([data-readonly])::before`, so the specular gloss drops to 0.2 (0.3 for confirm). The body rules beside these (lines 167, 222) leave out `:disabled, [data-disabled]`, so the body does not react. A disabled button visibly half-reacts to a press. The `::before` rules should use the same `:not(:disabled, [data-disabled], [data-readonly])` guard as the body rules they pair with.
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

<!-- done: 3 findings, files read: 15 -->
