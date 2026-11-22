## paintPreviewCss places radial and conic gradients by treating pixel centers as box fractions
- where: packages/paint/src/paintPreview.ts:101 (paintPreviewCss), also :112
- scenario: a radial gradient `{ kind: 'radial-gradient', center: { x: 200, y: 150 }, radius: 100, stops }` with default `'screen'` units (or `'world'`/`'local'`) → `pct(200)` writes `at 20000.0% 15000.0%`, so the chip shows only the far end of the ramp (one flat color). The function's doc says a paint in world or local units "shows the ramp and not the placement", but `pct` runs whatever the units are. Only `'bounds'` should use the center; the others should center the ramp at 50% 50%.
- evidence: read
- severity: medium

## lerpPaint throws on a solid or gradient-stop color that parseColor cannot read
- where: packages/paint/src/lerpPaint.ts:20 (rgbaOf), reached from solidRgba :40 and mixStopColor :83
- scenario: `lerpPaint({ color: 'var(--accent)' }, { color: 'red' }, 0.3)`, or two gradients whose stops include `lab(50% 40 20)` / `currentColor` → `parseColor` throws "unrecognized color" in the middle of a blend. Other readers in the package accept such colors: `paintKey` keys them by text (`solidColorKey`), and `toHex8` says the renderer accepts arbitrary CSS. It should fall back to the hold-`a`-until-halfway rule that the doc gives for paints it cannot mix.
- evidence: read
- severity: medium

## OKLCH/OKLab to sRGB is gamut-mapped two different ways
- where: packages/paint/src/color.ts:260 (parseOkFunction) vs packages/paint/src/colorSpaces.ts:248 (oklchDegToHex) and packages/paint/src/palette.ts:150 (colorLiteralToHex)
- scenario: `parseColor('oklch(0.7 0.4 30)')` clamps each linear channel on its own, which shifts the hue and lightness. `oklchDegToHex(0.7, 0.4, 30)` and `colorLiteralToHex({ space: 'oklch', coords: [0.7, 0.4, 30] })` reduce chroma at constant lightness (`clipToGamut`). So one out-of-gamut color comes out as two different sRGB colors, depending on whether it arrived as a CSS string or as a literal or degrees.
- evidence: read
- severity: medium

## paintPreviewCss throws for a gradient with a stop parseColor rejects, instead of returning undefined
- where: packages/paint/src/paintPreview.ts:67 (sampledStops → sampleGradientStops → resolveGradientStops → parseColor)
- scenario: a linear gradient with a stop `{ offset: 1, color: 'lab(60% 20 30)' }` or `'currentColor'` → `parseColor` throws inside a swatch render. The doc promises `undefined` for a paint with no CSS form, and a solid paint with the same color passes through unparsed (`faded(solid, …)`).
- evidence: read
- severity: low

## lerpStroke turns missing vertexWidths entries on a `{ px }` stroke into fixed world widths
- where: packages/paint/src/lerpPaint.ts:136-144 (widthNumber, lerpVertexWidths)
- scenario: both strokes have `width: { px: 4 }` and `vertexWidths` of one length with some entries `undefined`. `vertexHalfWidths(entry, 4)` fills those entries with 2 world units each and writes them back as real entries. Before the blend, a missing entry fell back to the stroke's resolved width (px/scale). After it, even at `t = 0`, that anchor is a fixed 4 world units, so it no longer matches the rest of the stroke once the view zooms.
- evidence: read (how the tessellator uses the fallback is inferred)
- severity: low

## mixRgbaWeighted returns the first color when every weight is zero
- where: packages/paint/src/mix.ts:41-47 (mixRgbaWeighted)
- scenario: `mixRgbaWeighted([{ color: red, weight: 0 }, { color: blue, weight: 0 }])` → `total` never rises above 0, so the result is red at full alpha. The doc says "a color weighing nothing contributes nothing", so a mix in which nothing weighs anything should come back transparent `[0, 0, 0, 0]`, not as its first member.
- evidence: read
- severity: low

## cssColorNotation writes `none` components that the package's own parseColor rejects
- where: packages/paint/src/palette.ts:178 (cssColorNotation) vs packages/paint/src/color.ts:183 (cssNumber)
- scenario: `cssColorNotation('hsl', ['none', 0, 50])` → `'hsl(none 0% 50%)'`, and `parseColor` of that string throws, because `cssNumber` accepts only numerals. A string the package writes cannot be read back by the package.
- evidence: read
- severity: low

## paintWithAlpha lets NaN through despite "clamped to 0..1"
- where: packages/paint/src/paintDefaults.ts:114 (paintWithAlpha)
- scenario: `paintWithAlpha(p, Number(''))` is fine (0), but `paintWithAlpha(p, NaN)` (for example from `parseFloat` of an emptied field) → `Math.max(0, Math.min(1, NaN))` is NaN, so the paint stores `opacity: NaN`, which `paintAlpha` then reports as NaN rather than a 0..1 value.
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

<!-- done: 8 findings, files read: 32 -->
