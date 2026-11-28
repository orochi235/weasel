# cursor — blind review findings

## A px-unit `brushRing` draws its ring line thicker as the radius grows, where the same ring in world units stays at chrome weight
- where: packages/cursor/src/brushRing.ts:21 (brushRing)
- scenario: `brushRing(60, 'px')` gives `{ glyph: 'brush', size: 145 }`. That goes to the painted tier with a fixed size, and `paintedCursorLayer` passes no `lineWidthScale` for a fixed size. The 1.6-unit stroke therefore draws at 1.6 × 145 / 24 ≈ 9.7 CSS px, inside a halo about 25 px wide. Below the cap, `brushRing(20, 'px')` bakes at size 48 with a 3.2 px line. On a zoom where 60 world units come to 60 px, `brushRing(60, 'world')` draws the same ring radius with a 1.6 px line, because the layer applies `chromeLineWidthScale` to a world-sized spec. So one function gives two line weights for the same on-screen ring, depending only on the unit. A brush ring should keep chrome line weight in either unit, as `worldCursorPx` / `chromeLineWidthScale` intend for a glyph that measures something.
- evidence: read (brushRing.ts, paint.ts `chromeLineWidthScale` doc, core `paintedCursorLayer.ts:91-99`, bake.ts `renderOp` uses unscaled widths)
- severity: medium
- fix: packages/cursor/src/brushRing.ts, packages/cursor/src/resolve.ts, packages/cursor/src/bake.ts, packages/core/src/canvas/paintedCursorLayer.ts
- size: design
- cause: line weight scaled with size on the fixed-size path, chrome weight on the world path
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

<!-- done: 1 findings, files read: 12 -->
