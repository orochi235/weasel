# Cursor area: blind review findings

## The fit guards bound a zero-radius arc by a circle on its chord, refusing a turn the glyph could take
- where: packages/cursor/src/types.ts:118 (walk)
- scenario: a glyph path `M 6 12 A 0 0 0 0 1 18 12` (SVG draws a zero-radius arc as a straight line). `walk` takes `r = max(|rx|, half)` = 6 and sees a disc of radius 6 at (12, 12), so `rotationFitsInBox` and `haloFitsInBox` measure a bulge the browser never draws. A glyph that fits is reported as not fitting, and `bakeCursor`/`resolveCursor` throw a `RangeError` for any nonzero angle on it. They should bound the arc as the segment it is (its two endpoints as radius-0 discs).
- evidence: read
- severity: low
- size: line
- cause: zero radius not read as a line
- confidence: sure

## The fit guards bound an arc whose ends meet by a full circle the browser never draws
- where: packages/cursor/src/types.ts:118 (walk)
- scenario: `M 12 12 A 9 9 0 0 1 12 12`: SVG leaves an arc out entirely when its endpoints are equal. Here `half` is 0, `r` is 9 and the center is the point itself, so `walk` reports a radius-9 disc. That can push a fitting glyph out of `haloFitsInBox`/`rotationFitsInBox`, and a turn on it throws. The arc should add nothing past its endpoint.
- evidence: read
- severity: low
- size: line
- cause: omitted arc still measured
- confidence: sure

## A circular arc whose rx is written negative is refused as elliptical
- where: packages/cursor/src/types.ts:115 (walk)
- scenario: `A -3 3 0 0 1 …`: SVG reads both radii by their absolute values, so this is a circle of radius 3. But `rx !== ry` compares the signed values, so the guard throws "elliptical arc (-3 by 3)", and `bakeCursor` throws for any nonzero angle on such a glyph. The comparison should be `Math.abs(rx) !== Math.abs(ry)`, which matches the `Math.abs(rx)` the next lines already use.
- evidence: read
- severity: low
- size: line
- cause: sign not stripped before comparing
- confidence: sure

## worldCursorPx answers Infinity for a finite world radius at a large zoom
- where: packages/cursor/src/paint.ts:117 (worldCursorPx)
- scenario: `resolveCursor({ glyph: 'brush', worldRadius: 1e300 })` resolves without complaint to a painted cursor. At a view scale of 1e9, `worldRadius * scale * (box / r)` overflows to `Infinity`, and `Math.max(1, Infinity)` keeps it. A painter that feeds that size to `cursorPaintMatrix` gets infinite entries (a·0 → NaN in the translation), and `chromeLineWidthScale` gives 0. The px unit refuses an overflowing size (`brushRing` throws; ruled in cursor audit 88), so the world unit answers the same overflow a second way: it hands out a non-finite size instead of refusing or capping it.
- evidence: read
- severity: low
- fix: packages/cursor/src/paint.ts
- size: line
- cause: overflow not guarded
- confidence: likely

## A fallback carrying an `image-set()` entry is refused though it is a valid cursor value
- where: packages/cursor/src/bake.ts:39 (IMAGE_ENTRY / bakeFallback)
- scenario: `bakeCursor(g, { fallback: 'image-set("a.png" 1x, "a@2x.png" 2x) 4 4, pointer' })` or the `-webkit-image-set(...)` form, both of which the browser accepts in a `cursor` list. `IMAGE_ENTRY` peels off only `url(…)` entries, so what remains is not a keyword and the call throws a `RangeError` "is not a cursor value". The doc comment promises refusal only for a fallback that does not end a `cursor` value in a keyword.
- evidence: read
- severity: low
- size: line
- cause: image entry grammar covers url() only
- confidence: likely

## Files read
packages/cursor/src/bake.ts
packages/cursor/src/brushRing.ts
packages/cursor/src/cursorSink.ts
packages/cursor/src/glyphs.ts
packages/cursor/src/index.ts
packages/cursor/src/mark.ts
packages/cursor/src/paint.ts
packages/cursor/src/paintedCursorState.ts
packages/cursor/src/pbt.fixture.ts
packages/cursor/src/registry.ts
packages/cursor/src/resolve.ts
packages/cursor/src/types.ts

<!-- done: 5 findings, files read: 12 -->
