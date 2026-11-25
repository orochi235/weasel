# Audit round 85 — renderer.cache (reviewer findings)

## GLMeshCache returns a cached handle without checking the attribute it was asked to carry
- where: packages/renderer/src/cache/GLMeshCache.ts:69 (handleFor), :97 (uploadRecurring)
- scenario: `drawClippedTrim` (packages/renderer/src/draw/clippedTrim.ts:62-64) asks for `ribbon.mesh` with
  `{ location: prog.attribute('a_trim'), size: 4, data: ribbon.trim }`. `handleFor` keys on the mesh alone, so once a
  persistent handle exists, any later call gets the geometry built for the first call's attribute: a program whose
  `a_trim` sits at another location (a different `trimmedRibbon()` variant, or a program rebuilt after the first
  upload) draws with the trim attribute bound to the wrong slot, and a call with no attribute gets one with an extra
  buffer (or the reverse). Expected: the attribute's location/size/data is part of what a hit must match, or the
  attribute is rejected for `handleFor`/`uploadRecurring`.
- evidence: read (callers read; that two variants actually differ in `a_trim` location is inference)
- severity: low

## Replacing the GLImageCache leaves every on-screen image reading as "not drawn" until the next render
- where: packages/renderer/src/cache/GLImageCache.ts:44 (imageSourceInLatestFrame), :88-107 (beginFrame/drewInLatestFrame)
- scenario: `ContextResources.setImageMinification` (packages/renderer/src/contextResources.ts:136-139) disposes the
  cache and builds a fresh one whose `lastDrawn` is empty. `imageSourceInLatestFrame` now answers `false` for every
  bitmap on screen, so a budget pass in `images/imageCache.ts:130-137` that runs before the next `render()` counts
  visible images as idle and releases them, and they flash/re-decode. Expected: the new cache inherits the previous
  frame's drawn set (or the query treats a cache that has not rendered a frame yet as "unknown", not "not drawn").
- evidence: read (the ordering of a budget pass between the swap and the next render is inference)
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
