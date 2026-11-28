## The pencil glyph's detail line runs off the ink, past the halo, as an unhaloed white stub
- where: packages/cursor/src/glyphs.ts:22 (GLYPHS.pencil, detail path `M 14 6 L 19 11`)
- scenario: the detail is collinear with the ink's butt edge (16,8)–(19,11) (all three points lie on y = x − 8) and overshoots the corner (16,8) by 2.83 units to (14,6). A `detail` is drawn in the halo color with no halo of its own and is meant to be "a division inside the silhouette" (types.ts). Here it straddles the outer edge, shaving 0.6 units of ink off the butt end, and its last ~1.5 units sit outside the 1.3-unit halo around that corner. On white paper that stub is invisible. On dark chrome, both tiers draw a white tick sticking out of the pencil's outline with no ink edge, because the painter and the baker share `cursorPaintOps`. It should lie inside the body, as the pen's detail `M 8.4 13.9 L 12.2 10.1` does. `haloFitsInBox` cannot catch this: the stub stays inside the box.
- evidence: read (worked out from the path coordinates; not rendered)
- severity: low
- fix: packages/cursor/scripts/glyphs/draw.mjs, packages/cursor/src/glyphs.ts (regenerated), the PENCIL fixtures in bake.test.ts / paint.test.ts
- size: line
- cause: detail authored on the silhouette edge, not inside it
- confidence: likely

## bakeFallback refuses valid `url(…)` hotspots written with a `+` sign, an exponent, or no space after `)`
- where: packages/cursor/src/bake.ts:40 (IMAGE_ENTRY, used by bakeFallback)
- scenario: the hotspot grammar is `-?\d*\.?\d+` behind a mandatory `\s+`. CSS `<number>` also allows a leading `+` and an exponent, so `fallback: 'url(a.png) +4 4, default'` and `'url(a.png) 1e1 4, default'` are valid cursor values. The browser takes them, but `bakeFallback` throws `RangeError: … is not a cursor value`, which reaches `bakeCursor`, `cursorFor` and `resolveCursor` on every tier. So a fallback the doc says is accepted ("optionally after `url(…)` images of its own") throws for an ordinary spelling of the hotspot. `image-set(…)` entries, which Chrome takes in `cursor`, are refused the same way.
- evidence: read
- severity: low
- size: line
- cause: hotspot regex narrower than the CSS number grammar
- confidence: sure

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

<!-- done: 2 findings, files read: 12 -->
