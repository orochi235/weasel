# Audit round 65: ui.components.TokenPanel

## Dragging one step of a scale rewrites every untouched step whose amount has more decimal places than the slider rounds to
- where: packages/ui/src/components/TokenPanel/Scale.tsx:139 (ScaleSlider `commit`)
- scenario: `Slider` hands `onInput` every thumb, the untouched ones carrying their value unchanged. `commit` recomputes
  each thumb's amount as `round(2 ** thumb.value)`, with `places` capped at 4, and writes any thumb whose amount `!==`
  `amounts[i]`. A step with more than 4 decimal places never round-trips: a ratio scale generated as `16 × 1.25^n` has
  `30.517578125px`, `38.14697265625px`, and so on. Dragging only the first step calls `onChange('--s-3', '30.5176px')`
  and the same for every other long step, on every drag tick. Those tokens become overrides (Reset appears) at a value
  the user never set. On a `factors` scale (base `1.5rem`, factor `1.3333`, giving `1.99995rem`), each untouched step
  takes the factors branch and calls `onScaleChange` with the *original* `factors` plus its own rounded entry, so the
  last call wins and the dragged step's new factor is lost. Expected: only the thumb that moved is written. Comparing
  with `shownAlike`, as the number fields do, or comparing thumb values, would do it.
- evidence: read (Slider passes the untouched thumbs through; `decimalPlaces` of `30.517578125` is 9, clamped to 4)
- severity: high

## Escape on a scale-step drag leaves the step overridden at its old value, and can refit its factor
- where: packages/ui/src/components/TokenPanel/Scale.tsx:172 (ScaleSlider, `onInput={commit}` with no `onCancel`)
- scenario: `commit` writes on every `onInput` tick. On Escape, `Slider`'s `finish` (useThumbDrags.ts:25) sends
  `onInput(start)` and then `onCancel`. ScaleSlider passes no `onCancel`, so the restore goes through `commit`. A step
  that was not overridden before the drag gets `onChange(name, '<original>px')`: it is now an override (Reset shown,
  accent name) instead of back to its own value, which would take `onChange(name, null)`. On a `factors` scale the
  restore writes `roundFit(amount / base)`, not the factor the scale had. The consumer cannot tell a cancel from an
  edit. Expected: Escape returns the tokens and the rule to what they were before the press.
- evidence: read
- severity: medium

## Picking a color for a transparent token writes a fully transparent color, so the pick has no visible effect
- where: packages/ui/src/components/TokenPanel/color.ts:40 (keepAlpha), via TokenControl.tsx:71
- scenario: a color token whose value is `transparent` (or `#0000`, or `rgb(0 0 0 / 0)`) parses with alpha 0, so
  `toHex` gives `#000000` and the native picker is shown. Picking red calls `set(keepAlpha('#ff0000', 'transparent'))`,
  which is `#ff000000`. The token is overridden but still invisible, and its swatch still looks empty. Expected: a
  pick on a fully transparent color comes out visible, for example opaque.
- evidence: read (`parseColor` maps `transparent` to `[0,0,0,0]`; `rgbaToHex` appends `00`)
- severity: medium

## A scale whose steps are all whole numbers can only be dragged or stepped to whole numbers
- where: packages/ui/src/components/TokenPanel/Scale.tsx:121 (ScaleSlider `places`, `round`, `finest`)
- scenario: `places` is the most decimal places any current step has. For `1rem 2rem 4rem`, `places` is 0, so
  dragging between the first two thumbs gives only `1rem` or `2rem`, the arrow keys step by 1rem, and nothing drags
  below `1rem` (keyStep's `Math.max(finest, …)` with `finest = 1`). Slider mode has no per-step number field, so
  `1.5rem` cannot be entered anywhere in the panel. Expected: the resolution comes from the unit or the track, not from
  whichever values the steps happen to hold.
- evidence: read
- severity: low

## A scale's long name runs under its reset button
- where: packages/ui/src/components/TokenPanel/TokenPanel.module.css:289 (`.scale > .name`, `.scale > .reset`)
- scenario: both are placed in grid column 1, row 1, and the reset is `justify-self: end`. `.name` still fills the
  whole cell, and its `text-overflow: ellipsis` cuts at the cell's edge, not at the reset. Once a step is overridden,
  a group name longer than the rail draws under the 16px reset icon instead of ellipsizing before it. Expected: the
  name gives up the reset's width (an end padding, or a nested flex row).
- evidence: read
- severity: low

## A token overridden to an empty value shows the unset color, not the overridden accent
- where: packages/ui/src/components/TokenPanel/TokenPanel.module.css:76 (`.row[data-unset] > .name` after `.row[data-overridden] > .name`)
- scenario: clearing a row's text field calls `onChange(name, '')`. The consumer marks the token `overridden` with value
  `''`, so the row gets both `data-overridden` and `data-unset`. The two rules have equal specificity and the unset rule
  comes later, so the name draws in `--wzl-fg-subtle` while a Reset is offered. A family's or a scale's name
  (`:has([data-overridden])`) keeps the accent in the same state. So the panel shows an override two ways.
- evidence: read
- severity: low

## Files read
packages/ui/src/components/TokenPanel/Scale.module.css
packages/ui/src/components/TokenPanel/Scale.tsx
packages/ui/src/components/TokenPanel/TokenControl.tsx
packages/ui/src/components/TokenPanel/TokenPanel.module.css
packages/ui/src/components/TokenPanel/TokenPanel.stories.module.css
packages/ui/src/components/TokenPanel/TokenPanel.stories.tsx
packages/ui/src/components/TokenPanel/TokenPanel.tsx
packages/ui/src/components/TokenPanel/color.ts
packages/ui/src/components/TokenPanel/index.ts
packages/ui/src/components/TokenPanel/parts.tsx
packages/ui/src/components/TokenPanel/tokenTypes.ts

<!-- done: 6 findings, files read: 11 -->
