I couldn't write `.skulkr/out/findings.md` because permission was denied, so the whole findings document is below.

## Picking a color in a translucent token's swatch writes an opaque hex, dropping the token's alpha
- where: packages/ui/src/components/TokenPanel/TokenControl.tsx:91 (ColorInput onChange), with color.ts:30 (toHex, "alpha dropped")
- scenario: token `--line-subtle` = `rgba(230, 231, 233, 0.1)` (the story has this one). `toHex` gives `#e6e7e9` for the native picker, and any pick commits `set(event.target.value)`, i.e. `#rrggbb`. So a 10%-alpha line becomes fully opaque as soon as the user changes its hue. It should keep the original alpha. The same happens to any `hsl(… / a)` or `#rrggbbaa` value.
- evidence: read
- severity: medium

## refitScale rounds a fitted ratio, step or factor to 2 places, so switching rule moves the steps; the slider's factor commit uses 3 places
- where: packages/ui/src/components/TokenPanel/tokenTypes.ts:44 (round2, refitScale) vs Scale.tsx:146 (ScaleSlider commit, `toFixed(3)`)
- scenario: a type scale at base 16 with ratio 1.333: steps 16 … 50.52. Refitting to `ratio` gives round2 = 1.33, and to `factors` gives 1, 1.33, 1.78, 2.37, 3.16. The consumer then regenerates 16·1.33⁴ = 50.06 instead of 50.52, so clicking a rule changes every step, although the doc says the scale is "fitted to the amounts its steps have now". The same factor is also stored at 2 decimals when refitted and at 3 when dragged, so the two paths give two answers. The NumberFields show 4 digits.
- evidence: read
- severity: medium

## A run row whose name equals its group draws a blank name when it is not the run's first row
- where: packages/ui/src/components/TokenPanel/TokenPanel.tsx:90 (rowRuns) and :237-240 (Section → TokenRow)
- scenario: rows `--wzl-space-1`, then `--wzl-space`, group `space`, `namePrefix="--wzl-"`. The second row gets `step: ''` and `first: false`, so its lead is drawn hidden and its label is `''`. The rail is empty, and the name shows only in the tooltip.
- evidence: read
- severity: low

## Row runs never form without a `--`-bearing namePrefix, the default
- where: packages/ui/src/components/TokenPanel/TokenPanel.tsx:98-101 (rowRuns)
- scenario: `namePrefix` defaults to `''` (and theme-editor passes `''`). The group compares as `space` but the name as `--space-1`. `'--space-1'.startsWith('space-')` is false, so no run ever forms, while the same tokens do form runs with `namePrefix="--"`.
- evidence: read
- severity: low

## A family's picked-step editor labels itself with the unprefixed group, ignoring namePrefix
- where: packages/ui/src/components/TokenPanel/TokenPanel.tsx:203 (Family → TokenRow label)
- scenario: the rail uses `shortName(group, …)`, but the picked row is labeled `` `${group} ${labels[at]}` `` with the raw group. With group `wzl-gray` and `namePrefix="--wzl-"`, the rail shows `gray` but the editor shows `wzl-gray 100`.
- evidence: read
- severity: low

## Dragging a generated step under a `factors` rule is dropped when `factors` is shorter than `tokens`, and gives an infinite factor at base 0
- where: packages/ui/src/components/TokenPanel/Scale.tsx:141-147 (ScaleSlider commit)
- scenario: (a) With `tokens: [a,b,c,d]` and `factors: [1, 1.5]`, dragging `c` gives `at = 2`. `map` never reaches index 2, so `onScaleChange` gets unchanged factors and `onChange` isn't called, and the drag does nothing. (b) With `base: 0` and an overridden positive step, `amount / 0` = Infinity, and `Infinity || f` stores Infinity as the factor.
- evidence: read
- severity: low

## inferTokenType reads an upper-case duration as a string though it accepts upper-case dimensions
- where: packages/ui/src/components/TokenPanel/tokenTypes.ts:121 (DURATION, no `i` flag) vs :117 (DIMENSION, `i`)
- scenario: `inferTokenType('200MS')` returns `'string'`, while `'4PX'` returns `'dimension'`. CSS units are case-insensitive.
- evidence: read
- severity: low

## isShadow only accepts `inset` as the first keyword
- where: packages/ui/src/components/TokenPanel/tokenTypes.ts:149 (isShadow)
- scenario: `inferTokenType('0 1px 2px red inset')` leaves `rest` as `['red', 'inset']` (length 2), so it returns `'string'` and the token is filed under Other, not Depth. CSS allows `inset` at either end.
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

<!-- done: 8 findings, files read: 11 -->