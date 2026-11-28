# cursor findings

## `bakeFallback` throws on valid cursor lists that use `image-set()` or exponent-form hotspot numbers
- where: packages/cursor/src/bake.ts:40 (IMAGE_ENTRY / bakeFallback)
- scenario: `cursorFor('pen', { fallback: 'image-set("a.png" 1x, "a@2x.png" 2x) 4 4, pointer' })` or `resolveCursor({ glyph: 'pen', fallback: 'url(a.png) 1e1 4, pointer' })`. CSS Basic UI 4 allows `image-set()` (and `-webkit-image-set()`) as a cursor image, and a hotspot `<number>` may be written `1e1` or `+3`. `IMAGE_ENTRY` only strips `url(…)` entries whose hotspot matches `-?\d*\.?\d+`. What is left is not a keyword, so the bake throws a `RangeError` for a value the browser would accept. It should strip any `<image>` entry the cursor grammar allows, or at least `image-set()` and CSS number syntax.
- evidence: read
- severity: low
- size: function
- cause: fallback grammar narrower than CSS `cursor`
- confidence: sure

## The pencil glyph's `detail` stroke sticks out past its ink as a white dash with no outline
- where: packages/cursor/src/glyphs.ts:20 (GLYPHS.pencil)
- fix: packages/cursor/scripts/gen-cursors.mjs (or the source it reads)
- scenario: the pencil's ink polygon ends at the edge (16,8)–(19,11). Its `detail` path is `M 14 6 L 19 11`, width 1.2, painted in the halo color with no halo of its own. It runs along that end edge and keeps going 2.83 units past (16,8), to (14,6). The ink's halo reaches only 1.3 units from (16,8), so about 1.5 units of the white line lie over bare background. On white paper that dash disappears; on dark chrome or dark artwork it shows as a stray white tick with no dark edge. The segment from (16,8) to (19,11) sits exactly on the ink's boundary, so half its width falls outside the ink as well. A detail is documented as "a division inside the silhouette", so it should end inside the ink, or the ink should reach (14,6).
- evidence: read (traced the coordinates; not rendered)
- severity: low
- size: line
- cause: detail authored past the ink silhouette
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

<!-- done: 2 findings, files read: 12 -->
