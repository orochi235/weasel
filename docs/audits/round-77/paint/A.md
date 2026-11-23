# Audit round 77 — area `paint`

## parseColor throws on CSS-valid percent a/b (oklab) and percent chroma (oklch)
- where: packages/paint/src/color.ts:254 (parseOkFunction)
- scenario: `parseColor('oklch(70% 40% 120)')` or `parseColor('oklab(50% 20% -10%)')`, both valid CSS Color 4 (100% = 0.4 for a, b and C), go through `componentNumber`, which takes only a bare `<number>`, so the parse returns null and `parseColor` throws "unrecognized color". `parseColor`'s doc lists `oklab()` and `oklch()` as supported with no caveat. This also makes `parsesAsColor`'s fallback (no `CSS.supports`, e.g. Node) answer false for those values, because `PARSED_FUNCTION` routes oklab/oklch through `tryParseColor`, while a browser answers true. They should read as 0.4 × percent / 100, the way L already accepts a percent.
- evidence: read
- severity: medium

## parsesAsColor's fallback accepts `color(srgb …)` values that parseColor rejects
- where: packages/paint/src/cssColor.ts:27 (PARSED_FUNCTION / isColorFunction)
- scenario: `parsesAsColor('color(srgb a b c)', null)` returns true: `PARSED_FUNCTION` leaves out `color`, so the value falls through to the bracket matcher, which only checks that the parentheses balance. `parseColor` reads `color(srgb …)` and `color(srgb-linear …)` in full (`parseColorFunction`) and throws on this value. The comment on `isColorFunction` says a function `parseColor` reads in full "is a color only where it parses, so the two never disagree", and for `color(srgb…)` they do disagree. `color(srgb` / `color(srgb-linear` should go through `tryParseColor` the way rgb/hsl/oklab/oklch do.
- evidence: read
- severity: low

## Files read
packages/paint/src/alignedStrokeRect.ts
packages/paint/src/chromaCurve.ts
packages/paint/src/color.ts
packages/paint/src/colorSpaces.ts
packages/paint/src/commandPaint.ts
packages/paint/src/contrast.ts
packages/paint/src/cssColor.ts
packages/paint/src/gradient.ts
packages/paint/src/hex.ts
packages/paint/src/hexAlpha.ts
packages/paint/src/hsl.ts
packages/paint/src/hue.ts
packages/paint/src/index.ts
packages/paint/src/isPaint.ts
packages/paint/src/lerpPaint.ts
packages/paint/src/mix.ts
packages/paint/src/paint.ts
packages/paint/src/paintDefaults.ts
packages/paint/src/paintKey.ts
packages/paint/src/paintPreview.ts
packages/paint/src/paintValue.ts
packages/paint/src/palette.ts
packages/paint/src/patternPaint.ts
packages/paint/src/patternTransform.ts
packages/paint/src/pbt.fixture.ts
packages/paint/src/ramp.ts
packages/paint/src/resolvePaint.ts
packages/paint/src/scalar.ts
packages/paint/src/shortArc.ts
packages/paint/src/strokeTrim.ts
packages/paint/src/texture.ts
packages/paint/src/vertexWidth.ts

<!-- done: 2 findings, files read: 32 -->
