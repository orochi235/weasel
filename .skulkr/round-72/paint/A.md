## paintPreviewCss places a radial or conic gradient's center as a fraction of the chip whatever its units, so a default-units gradient previews far off the chip
- where: packages/paint/src/paintPreview.ts:101 (paintPreviewCss), also :112
- scenario: `{ kind: 'radial-gradient', center: { x: 200, y: 150 }, radius: 100, stops: [...] }` (units omitted, so `'screen'` pixels) previews as `radial-gradient(circle at 20000.0% 15000.0%, …)`. The circle's center is hundreds of chip-widths away, so the whole chip shows roughly the last stop's color and none of the ramp. The same happens for a conic gradient. The doc says a `'world'` or `'local'` paint "shows the ramp and not the placement", but nothing branches on `units`: only a `'bounds'` paint's center is a fraction of the box, and every other unit should fall back to the chip's center (`at 50% 50%`).
- evidence: read
- severity: medium

## parsesAsColor's fallback parser accepts any body inside a color function, so outside a browser it calls things colors that parseColor rejects
- where: packages/paint/src/cssColor.ts:43 (isColorFunction), :24 (parsesAsColor)
- scenario: when there is no `CSS.supports` (Node, SSR, workers), `parsesAsColor('rgb(nonsense)')`, `parsesAsColor('hsl(1 2)')` and `parsesAsColor('rgb( )')` all return true, because `isColorFunction` only checks that the parentheses balance and close at the end. `parseColor`/`tryParseColor` in the same package throw or return null for each. So the package gives two different answers to "is this a color". A caller that gates on `parsesAsColor` and then parses the value gets a throw.
- evidence: read
- severity: low

## mixRgbaWeighted returns the first color unchanged when every weight is zero
- where: packages/paint/src/mix.ts:41 (mixRgbaWeighted)
- scenario: `mixRgbaWeighted([{ color: [1,0,0,1], weight: 0 }, { color: [0,0,1,1], weight: 0 }])` returns `[1,0,0,1]`, opaque red. The doc says "a color weighing nothing contributes nothing", yet here a zero-weight color is the whole result. A single member with weight 0 does the same. The result should be transparent (`[0,0,0,0]`, as `mixRgba` answers for zero total alpha), or the function should reject a zero total.
- evidence: read
- severity: low

## paintWithAlpha passes NaN through as the opacity, though its doc says the alpha is clamped
- where: packages/paint/src/paintDefaults.ts:114 (paintWithAlpha)
- scenario: `paintWithAlpha({ color: '#fff' }, NaN)` (an emptied numeric field, for example) returns `{ color: '#fff', opacity: NaN }`, because `Math.max(0, Math.min(1, NaN))` is NaN. The sibling `withAlpha01` in hexAlpha.ts reads NaN as 0 through `byteHex`. So one question gets two answers, and a NaN opacity goes into the scene.
- evidence: read
- severity: low

## Gradient stop sampling blends straight (non-premultiplied) alpha, so a ramp to `transparent` darkens in the middle
- where: packages/paint/src/gradient.ts:62 (sampleResolvedStops), via colorSpaces.ts:171 lerpColorArray
- scenario: stops `[{0,'#ffffff'},{1,'transparent'}]` sample at t=0.5 to about `[0.5,0.5,0.5,0.5]`: a half-transparent gray, not half-transparent white. CSS gradients interpolate premultiplied and give white at 50% alpha. The same package's `mixRgba` and `lerpPaint` premultiply "as CSS does", so the swatch preview (`paintPreviewCss` samples through this function) and the GL ramp both show a gray fringe that a browser's own gradient would not.
- evidence: read
- severity: low

## paintPreviewCss throws on a gradient whose stop color parseColor cannot read
- where: packages/paint/src/paintPreview.ts:67 (sampledStops) → gradient.ts:33 resolveGradientStops
- scenario: a gradient read from a file or a paste with a stop color such as `'lab(50 20 30)'` or `'currentColor'` makes `paintPreviewCss` throw from `parseColor`, which takes down the swatch or chip that renders it. The function's contract is "a CSS `background` value, or `undefined` for a paint with no CSS form", so it should return `undefined` (or skip the stop), not throw.
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
