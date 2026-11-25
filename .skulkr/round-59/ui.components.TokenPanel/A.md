## Picking a color in a row's swatch writes an opaque hex over a translucent token, dropping its alpha
- where: packages/ui/src/components/TokenPanel/TokenControl.tsx:93 (ColorInput onChange), with color.ts:30 (toHex)
- scenario: a color token `rgba(230, 231, 233, 0.1)` (the story's `--line-subtle`) shows `#e6e7e9` in the native picker because `toHex` drops alpha for display; picking any color calls `set(event.target.value)`, so the token becomes `#rrggbb` with alpha 1. The swatch is offered for every color `toHex` can convert, translucent ones included, and nothing keeps the original alpha. The pick should keep the token's alpha (write `#rrggbbaa` or rgba), or the picker should not be offered for a translucent value.
- evidence: read
- severity: medium

## Under the default `namePrefix: ''` rows never form runs, because the name keeps its `--` while the group has none
- where: packages/ui/src/components/TokenPanel/TokenPanel.tsx:98-100 (rowRuns)
- scenario: tokens `--font-ui` and `--font-weight-bold` in group `font` (the story's data), with no `namePrefix`. `group = shortName('font', '')` is `'font'`, and `short = shortName('--font-ui', '')` is `'--font-ui'`, which does not start with `'font-'`, so `fits` is false and no run forms. With `namePrefix: '--'` the same rows do form a run. The group side strips `--` from the prefix (`prefix.replace(/^--/, '')`) but the name side compares against the raw prefix, so whether runs form depends on whether the prefix happens to include the `--`. It works for `'--wzl-'` but fails for `''` and for `'wzl-'`. Families and scales show the group bare (`gray`) while lone rows next to them show `--gray-…`, the same mismatch. The name should be compared with its leading `--` stripped too.
- evidence: read
- severity: low

## A scale's Reset pushes its name to a second grid row, so overriding a step moves the name and slider down
- where: packages/ui/src/components/TokenPanel/TokenPanel.module.css:288-292 (`.scale > .reset`), with Scale.tsx:198-209
- scenario: `.scale > .reset` is placed at `grid-column: 1; grid-row: 1`, but `.name` sets only `grid-column: 1`. Grid auto-placement puts the fully placed reset (and `.rule` at row 1) first, then moves the name's cursor down past the occupied cell, so the name lands in row 2 and the slider or steps in row 3. The moment any step is overridden (Reset appears), the scale's name drops a row below the reset glyph and the whole block grows. The comment says the reset should "sit at the end of its name", which needs `.name` pinned to row 1 too (e.g. `.scale > .name { grid-row: 1 }`).
- evidence: read
- severity: low

## A factors scale with base 0 writes an Infinity factor when a step is dragged
- where: packages/ui/src/components/TokenPanel/Scale.tsx:146 (ScaleSlider commit), with tokenTypes.ts:57 (refitScale) and Scale.tsx:56 (base field)
- scenario: the base field accepts 0 (`Number.isFinite(0)`). With `rule.kind === 'factors'` and `base: 0`, dragging a generated step gives `Number((amount / 0).toFixed(3))`, which is `Infinity`. `|| f` catches only 0 and NaN, so `onScaleChange` receives `factors: [..., Infinity, ...]`. Switching to factors with base 0 instead turns every factor into 1 (`scale.base ? … : 1`), so the same zero base is handled two different ways on the two paths. A negative base gives negative factors from the slider in the same way.
- evidence: read
- severity: low

## Refitting to `ratio` with a non-positive last step yields `ratio: NaN`
- where: packages/ui/src/components/TokenPanel/tokenTypes.ts:59 (refitScale)
- scenario: the amounts are `[2, 3, -4]` (the last step edited negative through ScaleStep's NumberField, which takes any finite number) and the user picks "ratio". `first > 0` passes, but `(-4 / 2) ** (1 / 2)` is NaN, so `round2(NaN)` gives NaN, which is handed to `onScaleChange` and then shown as the ratio. Also `last === 0` gives ratio 0. The guard checks only `first`, not `last / first > 0`.
- evidence: read
- severity: low

## Sorting tokens into sections copies the section's array on every token (quadratic)
- where: packages/ui/src/components/TokenPanel/TokenPanel.tsx:317 (HeldTokenPanel byCategory)
- scenario: `sections.set(category, [...(sections.get(category) ?? []), token])` copies the whole section for each token, so n tokens in one category cost O(n²) element copies on every change to `tokens`. Consumers rebuild `tokens` each render (the story does), and every edit recomputes it. A theme with a few thousand tokens does millions of copies per keystroke. A push into the existing array does the same in O(n).
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
