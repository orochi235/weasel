I wasn't allowed to write `.skulkr/out/findings.md` (permission denied), so the whole document is below.

## `domButton.measure` ignores a `ControlSizeScope`, so it measures a different size than `draw` renders
- where: packages/ui/src/components/Button/Button.tsx:183 (buttonFaceOf), :211 (domButton.measure)
- scenario: inside `<ControlSizeScope size="sm">`, `domButton.measure({ children: 'Save' }, c, env)` builds the face with `size = 'md'` (the `buttonFaceOf` default), so it reads `--wzl-control-h` and `--wzl-space-6` padding. `domButton.draw` renders `<Button>`, which resolves `useControlSize(undefined)` to `sm` and gets `.size_sm` (`--wzl-control-h-sm`, `--wzl-space-4`). The scope is React context only (ControlSize.tsx:20) and sets no CSS variable, so the env cannot pick it up either. A layout built from `measure` gets the wrong height and width. Measure and draw should resolve the size the same way, for example by taking the resolved size as an input.
- evidence: read
- severity: medium

## The lab's "Export deltas" diffs against the lab's own defaults, not the values Button.module.css ships
- where: packages/ui/src/components/Button/lab/buttonLabConfig.ts:22-35 (BUTTON_LAB_DEFAULTS), :75 (exportDeltas)
- scenario: `BUTTON_LAB_DEFAULTS` uses gloss top 0.7, mid 0.18, inset-hi 0.7, radius 999px, height 28px, pad 16px, weight 400 and accent #2e1f7a. Button.module.css:31-40 ships 0.42, 0.12 and 0.42, a radius of `calc(height * 0.1)`, the control-height and space tokens, and medium weight. With the knobs left at their starting values the lab draws a visibly different button, yet export prints "No deltas: every knob is at its default." Tuning gloss top back to the shipped 0.42 reports `--btn-gloss-top: 0.42` as a change, and pasting it changes nothing. The doc on `exportDeltas` promises "the rule to paste into `Button.module.css` to ship the tuned look", which this does not deliver. The weight radio offers only 200/300/400, so the shipped weight of 500 cannot be expressed at all.
- evidence: read
- severity: medium

## Pasting exported shape deltas into `.button` does nothing, because the `.size_*` rules override them
- where: packages/ui/src/components/Button/lab/buttonLabConfig.ts:79 (exportDeltas); packages/ui/src/components/Button/Button.module.css:116-118
- scenario: change Height, Pad x or Font size in the lab and export. The output is `.button { --btn-height: 40px; --btn-padx: …; --btn-fontsize: … }`. Every rendered button also carries `.size_xs`, `.size_sm` or `.size_md`. Those rules have the same specificity and come later in the file, and they set the same three properties, so the pasted values never apply. In the lab they appear to work only because they are set as inline style. The export also emits `--wzl-accent` when Accent changes, and pasted into `.button` that overrides the theme's accent on every button.
- evidence: read
- severity: low

## The lab's "hovered" preview shows the confirm hover for every variant
- where: packages/ui/src/components/Button/lab/ButtonLab.stories.module.css:37 (.hovered); packages/ui/src/components/Button/lab/ButtonLabView.tsx:53
- scenario: with Variant set to solid, the held-hover sample uses `brightness(1.08) saturate(1.06)`, but the real `.variant_solid:hover` is `brightness(1.1)` (Button.module.css:219). With Variant set to ghost, the real hover is a `--wzl-surface-hover` background (Button.module.css:243) with no filter, yet the sample shows a brightened transparent button. The hover values are written twice and the lab's copy matches only `stance="confirm"`.
- evidence: read
- severity: low

## A text-inset angle of 360° exports a spurious `--btn-text-inset-x: -0.00px` delta
- where: packages/ui/src/components/Button/lab/buttonLabConfig.ts:69-70 (buttonVarsOf), :78 (exportDeltas)
- scenario: `Math.sin(2π)` is about -2.4e-16, and `toFixed(2)` turns it into `"-0.00"`. That string differs from the default's `"0.00"`, so the export lists an x offset that equals the default as a delta. The same happens at any angle where sin or cos rounds to negative zero.
- evidence: read
- severity: low

## A label that renders nothing (`false`, `null`, `''`) still gets a label slot and a gap, so an icon sits off-center
- where: packages/ui/src/components/Button/Button.tsx:186 (buttonFaceOf)
- scenario: `<Button leadingIcon={<Plus/>}>{showText && 'Add'}</Button>` with `showText` false. `children` is `false`, not `undefined`, so `label` is `nodeText(false) === ''` and `buttonParts` adds a `'label'` part. The button renders an empty `<span class=label>` after the icon, separated by the flex `gap` (`--wzl-space-3`), and the leading slot gains `.lead`. The icon is pushed off-center by one gap width, and `measureButton` adds the same extra gap. Only `undefined` is treated as having no label.
- evidence: read
- severity: low

## The RovingToolbar story's tab stop does not follow clicks or focus
- where: packages/ui/src/components/Button/Button.native.stories.tsx:38-49 (Toolbar)
- scenario: click "Right", Tab out of the toolbar, then Shift+Tab back in. `stop` is still 0, because only ArrowLeft and ArrowRight update it, so focus lands on "Left" rather than the button last used. A roving tab stop should move to whichever member takes focus. The story is offered as the reference for roving focus through `tabIndex` and `onKeyDown`.
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

<!-- done: 7 findings, files read: 15 -->