# Audit round 53 — area `paint` (blind reviewer)

## `paintWithColor` multiplies a non-hex color's alpha into the old opacity, where its doc says the color's alpha wins
- where: packages/paint/src/paintDefaults.ts:113 (paintWithColor), with solid at :59 and hasHexAlpha at :68
- scenario: `paintWithColor({ color: '#000', opacity: 0.5 }, 'rgba(0, 0, 0, 0.5)')`. `hasHexAlpha` only recognizes `#rgba`/`#rrggbbaa`, so the result is `{ color: 'rgba(0, 0, 0, 0.5)', opacity: 0.5 }`, which the renderer draws at 0.25 alpha. The doc says "An alpha channel in `color` wins", so it should draw at 0.5. The same gap is in `solid('rgba(…, 0.5)')` / `solidFill` / `solidStroke`: the alpha stays in the color, the multiply-twice hazard `solid`'s doc says moving alpha to `opacity` avoids (`hsl(… / 50%)`, `#…` named-or-function colors alike).
- evidence: read
- severity: medium

## `parsesAsColor` without `CSS.supports` rejects most of the named colors `parseColor` reads
- where: packages/paint/src/cssColor.ts:4 (KEYWORDS), :42 (parsesAsColor)
- scenario: where there is no `CSS.supports` (jsdom, SSR, a worker), `parsesAsColor('coral')`, `'rebeccapurple'` or `'darkgray'` returns false, since the fallback keyword set holds 20 names. `parseColor('coral')` reads all 148 named colors (color.ts NAMED_COLORS). So the kit answers "is this a color" two ways, and the edit overlay's `::selection` rule (which is gated on `parsesAsColor`, per docs/unruled.md) drops a valid stored color with a warning outside a browser. The fallback should use parseColor's named-color table.
- evidence: read
- severity: low

## `strokeHasInk` / `strokeKey` report ink for a stroke whose dash is non-finite, which draws nothing
- where: packages/paint/src/paintKey.ts:70 (strokeHasInk), :86 (strokeKey)
- scenario: `{ paint: solid('#000'), width: 2, dash: [NaN, 4] }`. `dashPattern` returns `'non-finite'`, which its doc says "draws no stroke at all". But `strokeHasInk` returns true and `strokeKey` returns a shape key instead of `'none'`, even though `strokeKey`'s doc promises "Every stroke that puts no ink down is `'none'`". Callers that skip inkless strokes (hit testing, export, grouping by key) treat it as visible.
- evidence: read
- severity: low

## `lerpPaint` turns a conic gradient's start angle the long way round
- where: packages/paint/src/lerpPaint.ts:108 (lerpGradient)
- scenario: blend two conic gradients with `angle: 6.2` and `angle: 0.1` (radians, nearly the same start). `lerp(a.angle, b.angle, t)` sweeps through 3.15 at t = 0.5, so the gradient spins almost a full turn during the blend instead of moving about 0.18 rad. The package's own polar lerps (`lerpOklch` via `shortArc`, `lerpHueDeg`) take the short arc, so this is the same question answered two ways. It should be `a.angle + shortArc(b.angle - a.angle) * t`, with exact `b.angle` at t = 1.
- evidence: read
- severity: low

## `sampleResolvedStops` returns the earlier of two coincident stops at their shared offset, while its comment says the later one wins
- where: packages/paint/src/gradient.ts:55-61 (sampleResolvedStops)
- scenario: stops `[0 red, 0.5 green, 0.5 blue, 1 white]`, `t = 0.5`. The loop's first matching pair is (0, 0.5): `t > hi.offset` is false, so it lerps with f = 1 and returns green. It never reaches the coincident pair (0.5, 0.5), where the "hard color break: take the later one" branch would return blue. Just past 0.5 it is blue. The GL ramp and the swatch track (`sampleGradientStops`) sample at exactly such offsets, so a texel lands on the earlier color where the code's stated rule (and CSS's) puts the later one.
- evidence: read
- severity: low

## `lerpStroke` drops `vertexWidths` and `vertexColors` from both sides, even where its doc says other fields are the nearer side's
- where: packages/paint/src/lerpPaint.ts:143 (lerpStroke)
- scenario: `lerpStroke(s, s, 0)` where `s` has `vertexWidths: [1, 8, 1]`. The result has no `vertexWidths`, so a tapered stroke draws uniform for the whole blend, including t = 0 and t = 1. The doc says "every other field is the nearer side's". docs/unruled.md:1786 lists this as Open (anchor counts can differ), not ruled. At minimum the nearer side's arrays belong in the result when both sides carry arrays of equal length.
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

<!-- done: 6 findings, files read: 32 -->
