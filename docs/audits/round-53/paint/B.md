## lerpPaint turns a fully transparent solid black, even at t = 0 and t = 1
- where: packages/paint/src/lerpPaint.ts:23 (mixColor → mixRgba, packages/paint/src/mix.ts:18), lerpPaint.ts:56
- scenario: `lerpPaint({ color: '#ff0000', opacity: 0 }, { color: '#ff0000', opacity: 0 }, 0)` → `mixRgba` sees mixed alpha 0 and returns `[0, 0, 0, 0]`, so `solidOf` answers `{ color: '#000000', opacity: 0 }`, not `a`. The same happens on the fade path (`lerpPaint(undefined, red, 0)`, line 52), where the doc promises "the other's color fully transparent", and in `lerpStroke`/`lerpFill`. A later `paintWithAlpha` on that step, or an inspector reading its color, shows black. `mixStopColor` (line 77) handles this exact case by mixing the opaque colors when the alpha comes out 0, so two paths in the same file decide clear-color mixing two different ways.
- evidence: read
- severity: low

## colorLiteralToHex answers null for `hsl` (and `srgb-linear`) literals the package can convert, so paletteColorAt falls back to white
- where: packages/paint/src/palette.ts:136 (colorLiteralToHex), used by packages/paint/src/paintDefaults.ts:43 (paletteColorAt)
- scenario: `ColorLiteral`'s doc (palette.ts:9) defines `hsl` coordinates, and the package ships `hslToSrgb` and `linearToSrgb`. But `colorLiteralToHex({ space: 'hsl', coords: [210, 50, 40] })` hits `default: return null` ("a space the kit cannot convert"). `paletteColorAt(0, { entries: [{ name: 'a', color: { space: 'hsl', coords: [210, 50, 40] } }] })` returns `DEFAULT_FILL_COLOR` (`#ffffffff`) instead of the palette's blue. The same goes for `{ space: 'srgb-linear', … }`. Expected: the hex of the color, as for srgb/oklab/oklch.
- evidence: read
- severity: medium

## parsesAsColor's fallback accepts multi-value strings that start with a color function
- where: packages/paint/src/cssColor.ts:3 (COLOR_FUNCTION), :42 (parsesAsColor)
- scenario: with no `CSS.supports` (jsdom, SSR, a worker), `parsesAsColor('rgb(0 0 0) 0 2px rgb(1 1 1)')` and `parsesAsColor('rgb(0,0,0) url(x)')` return true, because `[^{};]+\)$` lets the body run through a `)` and on to a later one. `packages/ui/src/components/TokenPanel/tokenTypes.ts:154` then classifies a shadow-like value as `'color'`. The overlay's `::selection` guard (`text-dom/src/overlayOpen.ts:64`) also writes such a value as a "color". A browser's `CSS.supports('color', …)` rejects both, so the answer depends on the environment.
- evidence: read
- severity: low

## parsesAsColor's fallback knows 20 named colors where parseColor beside it reads all 148
- where: packages/paint/src/cssColor.ts:4 (KEYWORDS), :42
- scenario: without `CSS.supports`, `parsesAsColor('coral')`, `'rebeccapurple'` or `'whitesmoke'` returns false, while `parseColor` in the same package reads each one (`NAMED_COLORS`, color.ts:276). In jsdom/SSR, a token panel value of `coral` is not typed as a color, and the overlay drops a `selectionBackground: 'coral'` with a warning. In the browser the same calls return true. So one question gets two answers, and the fallback's answer differs from the browser's.
- evidence: read
- severity: low

## lerpGradient blends a conic gradient's angle linearly, spinning the long way across ±π
- where: packages/paint/src/lerpPaint.ts:108 (lerpGradient, conic branch)
- scenario: a conic gradient's `angle` is periodic. `gradientGeometry` and `withGradientKind` produce angles in [-π, π] from `atan2`. Blending conic A (`angle: 3.0`) with conic B (`angle: -3.0`), 16° apart, gives `angle: 0` at t = 0.5, so the gradient sweeps nearly half a turn through the blend's steps instead of the 16° between the ends. Hue in the same package uses `shortArc` and `lerpHueDeg` for exactly this.
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

<!-- done: 5 findings, files read: 32 -->
