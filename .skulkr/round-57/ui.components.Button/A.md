I couldn't write `.skulkr/out/findings.md` because the write permission was declined, so the whole document is here instead.

## CLOSE_BUTTON_PROPS' 16px close glyph is drawn at 12px: the size-class svg rule overrides Icon's width/height attributes
- where: packages/ui/src/components/Button/closeButtonProps.tsx:17 (CLOSE_BUTTON_PROPS) with packages/ui/src/components/Button/Button.module.css:311 (`.size_sm .iconSlot > svg`)
- scenario: `<Button {...CLOSE_BUTTON_PROPS} aria-label="Close" />` renders `<Icon size={16}>`, which `Icon` writes as the svg's `width="16" height="16"` presentation attributes (Icon.tsx:69). The preset is `size: 'sm'`, and `.size_sm .iconSlot > svg { width: var(--wzl-button-icon-size, 12px); height: … }` beats presentation attributes, so the glyph draws at 12px. The `size={16}` the preset asks for has no effect. The same rule clamps any consumer's sized `<Icon>` or svg inside a Button to 12/14px with no way to opt out.
- evidence: read
- severity: low

## domButton.measure sizes an unsized button as `md` while draw takes the ControlSizeScope's size
- where: packages/ui/src/components/Button/Button.tsx:211 (domButton.measure), :183 (buttonFaceOf), against :136-137 (Button)
- scenario: inside `<ControlSizeScope size="sm">`, `domButton.measure({ children: 'Save' }, c, env)` defaults `size = 'md'` and returns an md height, padding and font. `domButton.draw` renders `<Button>`, which calls `useControlSize(undefined)` and draws `size_sm`. Measure and draw disagree, so the laid-out box is bigger than the button drawn in it.
- evidence: read
- severity: medium

## domButton.measure ignores `variant`, so a `link` button is measured as a padded control box
- where: packages/ui/src/components/Button/Button.tsx:182-187 (buttonFaceOf), :211; Button.module.css:262-273 (.variant_link)
- scenario: `measure({ variant: 'link', children: 'x' })` returns the control height, `--btn-padx` padding and the button font. `.variant_link` draws `display: inline; height: auto; padding: 0; font: inherit`. The measured box doesn't match the drawn link.
- evidence: read
- severity: medium

## The lab's "Export deltas" diffs against BUTTON_LAB_DEFAULTS, not the stylesheet's defaults, so the exported rule doesn't reproduce the tuned look
- where: packages/ui/src/components/Button/lab/buttonLabConfig.ts:22-35, :75-80 (exportDeltas)
- scenario: export with every knob untouched and it prints "No deltas". But the look on screen (`--btn-gloss-top 0.7`, `--btn-inset-hi 0.7`, radius 999px, height 28px, padx 16px, weight 400) differs from what Button.module.css ships (0.42, 0.42, `calc(h*0.1)`, the control height, `--wzl-space-6`, medium). Any knob left at the lab default is dropped, so pasting the exported rule doesn't give the tuned button.
- evidence: read
- severity: medium

## A read-only toggle Button still shows hover, press-in and a pointer cursor while ignoring the press
- where: packages/ui/src/components/Button/Button.module.css:108-112, :219-233, :243-259, :290; Button.tsx:160
- scenario: a `pressed` Button inside a `ReadOnly` scope gets `data-readonly` and a `preventDefault` onClick from `stillReachable`. No CSS in packages/ui matches `[data-readonly]`, so it keeps `cursor: pointer`, its hover effects and its `:active` pressed surface plus `translateY`. It looks live, but the press does nothing.
- evidence: read
- severity: low

## A pressed confirm button loses its accent body
- where: packages/ui/src/components/Button/Button.module.css:290-296
- scenario: `<Button stance="confirm" pressed>`. `.pressed:not(…)` has specificity (0,2,0), equal to `.variant_solid[data-stance='confirm']`, and comes later, so it replaces the accent background, color and shadow with the neutral pressed treatment. The confirm-only rule at :296 then dims a body that is already gone, and the button renders like a pressed solid one.
- evidence: read
- severity: low

## The lab's held "hover" sample always applies the confirm hover filter
- where: packages/ui/src/components/Button/lab/ButtonLab.stories.module.css:37-39; ButtonLabView.tsx:53
- scenario: with Variant set to solid or ghost, the sample shows `brightness(1.08) saturate(1.06)`, which is confirm's hover. The real hovers are `brightness(1.1)` for solid (Button.module.css:219) and a hover background with no filter for ghost (:243).
- evidence: read
- severity: low

## A falsy non-undefined label (`null`, `false`, `''`) still makes a label part
- where: packages/ui/src/components/Button/Button.tsx:186, :190
- scenario: `<Button leadingIcon={<Plus/>}>{expanded && 'Add'}</Button>` with `expanded = false` gives `label = nodeText(false) = ''`. That produces an empty label span, a gap and the `.lead` baseline hack, and the measure matches it, so the button draws padded and off-center where `children={undefined}` would give a clean icon button.
- evidence: read
- severity: low

## The Button story's `size` control omits `xs`
- where: packages/ui/src/components/Button/Button.stories.tsx:23
- scenario: the control offers `['sm', 'md']` only, though `ButtonSize` includes `xs` and Matrix renders it (:207).
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

<!-- done: 9 findings, files read: 15 -->