I couldn't write the findings file because permission to write `.skulk/out/findings.md` was denied, so the whole document is below. The checked-out tree is at HEAD `830b463cc1`, not the frozen commit `608f35f…` the brief names. My line numbers come from the files as checked out.

## An aligned (inside/outside) glyph outline stroke with a `{ px }` width ignores the screen metric, so it is not `px` wide in every direction under a stretched or sheared em-to-screen map
- where: packages/renderer/src/cache/outlineStrokeMeshCache.ts:74-79 (outlineStrokeMesh)
- scenario: text with `stroke: { width: { px: 2 }, align: 'outside' }` drawn under a non-uniform scale (or a synthetic oblique / skew), so `glyphOutlineMesh` passes a non-null `metric`. The `align === 'center'` branch hands `metric` to `tessellateStroke` and builds the ribbon in screen space. The aligned branch calls `strokeToPath(glyph, sized, { flattenTolerance })` with no metric or `frame`, so the ribbon is built isotropically in em at `width.px / pxPerEm`, then stretched by the transform. On screen it is wider along the stretched axis than across it. That breaks the function's own contract ("Given a `metric`, the ribbon is built in its space") and `outlineGroupStrokeMesh`'s ("so it is that many pixels wide in every direction"). The cache key still includes `metricKey(metric)`, so several entries hold the same metric-blind mesh. It should build the aligned outline in the metric's space, e.g. via `strokeToPath`'s `frame`, the way the center branch does.
- evidence: read
- severity: medium

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

<!-- done: 1 findings, files read: 11 -->