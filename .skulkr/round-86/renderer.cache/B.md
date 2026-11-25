# Audit round 86 — renderer.cache — blind reviewer findings

## Glyph-outline stroke ribbon applies world-unit `vertexWidths` and `{ length }` trim edges in em space
- where: packages/renderer/src/cache/outlineStrokeMeshCache.ts:76 (outlineStrokeMesh: `sized = { ...stroke, width: emWidth }`), with its keys at :62-63
- scenario: A text command's stroke is a full `Stroke` (`LaidOutGroup.stroke?: Stroke`, packages/text/src/layout/paintRuns.ts:82). The ribbon is built in em space, and only `width` is converted (`emWidth`); the caller, `outlineGroupStrokeMesh` (packages/renderer/src/glyphOutlineMesh.ts:62-73), converts dash and dashOffset through `scaledDash`, which touches nothing else (packages/paint/src/paint.ts:348-355). `stroke.vertexWidths` ("entries are world units, even on a `{ px }` stroke", paint.ts:220) and a trim edge `{ length: L }` (world arc length) reach `tessellateStroke` / `strokeToPath` unscaled. Text at fontSize 48 with `vertexWidths: [2, …]` draws a ribbon 2 em wide (96 world units) instead of 2 world units, and `trim: { end: { length: 10 } }` stops 10 em (480 units) along each glyph instead of 10 units. Expected: every length is converted to em by `1 / glyph.scale` (or to the metric's units on a `{ px }` ribbon) the way `width` and the dashes are. The cache key also hashes the raw world values, so two font sizes share a mesh that is wrong for both.
- evidence: read (traced the call chain; did not run it)
- severity: medium

## The glyph-outline fill cache ignores the default open-fill rule, which the path fill cache rebuilds on
- where: packages/renderer/src/cache/outlineMeshCache.ts:34-45 (outlineMesh)
- scenario: `getMesh` (cache.ts:17-26) stores `defaultOpenFill()` with each mesh and rebuilds when `setDefaultOpenFill` changes it, because `tessellate` closes or skips open subpaths by that global (packages/geom/src/openFill.ts:18-20). `outlineMesh` tessellates `pathFromD(d)` under the same global but keys only on the glyph and `faceGeneration()`. A glyph whose `d` has a subpath without `Z` (an outline face registered from hand-written or SVG-font paths) is cached under whichever rule held at first draw. After `setDefaultOpenFill('none')`, a path fill stops filling open subpaths while the glyph keeps its old filled mesh until the cache is evicted (2048 glyphs) or the faces change. The same question gets two answers in two caches.
- evidence: read (inference: whether a registered face can carry an unclosed contour was not checked)
- severity: low

## Files read
packages/renderer/src/cache/GLImageCache.ts
packages/renderer/src/cache/GLMeshCache.ts
packages/renderer/src/cache/GLTextureCache.ts
packages/renderer/src/cache/GradientRampAtlas.ts
packages/renderer/src/cache/cache.ts
packages/renderer/src/cache/markerCommandCache.ts
packages/renderer/src/cache/outlineMeshCache.ts
packages/renderer/src/cache/outlineStrokeMeshCache.ts
packages/renderer/src/cache/strokeMeshCache.ts
packages/renderer/src/cache/uploadPremultiplied.ts
packages/renderer/src/cache/whiteTexture.ts

<!-- done: 2 findings, files read: 11 -->
