## Gamut clipping bisects the requested chroma's scale in 5 steps, so a far-over request can lose up to half the real ceiling
- where: packages/paint/src/colorSpaces.ts:96 (clipToGamut); reached by oklchDegToHex, oklabToSrgbU8, oklabToSrgbClipped, parseColor's `oklch()`, colorLiteralToHex
- scenario: precision is 1/32 of the *requested* chroma, not of the ceiling, and the result is always the in-gamut `lo`. `oklchDegToHex(L, 1, h)` where the hue's real ceiling is C≈0.06: t=0.5, 0.25, 0.125, 0.0625 are all out of gamut, t=0.03125 is in, so it returns C≈0.031, about half the ceiling. With a ceiling of 0.1 it returns 0.094. `oklchDegToHex`'s doc says asking "far more than exists" finds a hue's ceiling, and that is the case this gets worst. The same 3% loss hits ordinary slightly-out-of-gamut colors through `interpolateSrgb`, which promises float precision. CLAMP_SLACK's own comment calls a 3% chroma cut visible. It should bisect to a tolerance relative to the boundary, with more iterations or an absolute chroma epsilon.
- evidence: read (traced the iterations by hand)
- severity: medium

## Gradient stops blend unpremultiplied, while lerpPaint and mixRgba premultiply: one decision answered two ways
- where: packages/paint/src/gradient.ts:59 (sampleResolvedStops → lerpColorArray)
- scenario: a stop list of `#ff0000` at 0 and `transparent` at 1 samples [0.5, 0, 0, 0.5] at the midpoint, a dark red fringe. CSS gradients interpolate premultiplied and give [1, 0, 0, 0.5]. `mixRgba` and `lerpPaint` in the same package premultiply on purpose ("a transparent side lends the result its opacity and none of its color"). `paintPreviewCss` bakes this unpremultiplied sampling into its CSS stops, so the swatch shows the fringe too. sampleResolvedStops is documented as "the single definition of what a stop list means", which makes the disagreement with mixRgba a package-level inconsistency.
- evidence: read
- severity: medium

## tryParseColor throws and catches on every call for an unreadable color, and parseColor never caches the failure
- where: packages/paint/src/color.ts:30 (parseColor), :40 (tryParseColor)
- scenario: a solid paint of `var(--accent)` or `currentColor` goes through paintKey → solidColorKey → tryParseColor on every call (paintKey reads solids every time by design), and through lerpPaint's rgbaOf per frame. Each call runs the whole parse, builds an Error with its stack, and catches it, because only successes enter CACHE. parseColor's doc says renderer hot paths call it per frame. The cache should remember failures, for example as a sentinel.
- evidence: read
- severity: low

## parsesAsColor's fallback accepts `color()` bodies that parseColor rejects, contrary to its stated invariant
- where: packages/paint/src/cssColor.ts:29 (PARSED_FUNCTION), :47 (isColorFunction)
- scenario: with no `CSS.supports` (Node, a worker), `parsesAsColor('color(srgb x y z)')` and `parsesAsColor('color(srgb 1 0)')` return true, because `color(` is missing from PARSED_FUNCTION and falls through to the bracket-balance check. `parseColor` throws on both. The doc comment says a function parseColor reads in full "is a color only where it parses, so the two never disagree", and parseColor does read `color(srgb …)` and `color(srgb-linear …)` in full.
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

<!-- done: 4 findings, files read: 32 -->
