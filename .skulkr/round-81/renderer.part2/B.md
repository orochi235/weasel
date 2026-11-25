# Audit round 81 — renderer.part2 findings

## A paint kind's programs silently replace a same-id program registered through `registerProgram`
- where: packages/renderer/src/paintKinds.ts:169 (holdPrograms)
- scenario: an app calls `registerProgram('stripes', { glsl: A })`, then registers a paint kind declaring `programs: { stripes: { glsl: B } }`. `holdPrograms` only checks for conflicts against other *kinds* in `PROGRAMS_HELD`, then calls `programSourceRegistry.register(id, …, { replace: true })`, so B replaces A with no error, and every custom shader command naming `stripes` now draws with the kind's shader until the kind is disposed. In the reverse order, `registerProgram('stripes', A)` after the kind throws `ExtensionConflictError` (registerProgram.ts:142). The same clash is answered two ways depending on registration order. Expected: the kind throws `ExtensionConflictError` for an id already holding other source that no kind of its own id put there, as it does for another kind's.
- evidence: read (paintKinds.ts holdPrograms; registerProgram.ts:140-163, the registry throws on different source unless `replace`)
- severity: medium

## A `chunks` tile with a chunk wide enough to cover it drops its `bg`
- where: packages/renderer/src/patterns/tileGeometry.ts:111 (tileGeometry, case 'chunks')
- scenario: `{ kind: 'chunks', color: 'rgba(0,0,0,0.5)', bg: '#f00', chunkSize: 40, size: 8 }`. The first chunk's `min(w, h) / 2 >= s·√2`, so the function returns `[{ rect, color }]` alone, discarding the `bg` rect it already pushed. The tile is half-transparent black over nothing instead of half-transparent black over red. Any chunk taking this branch also discards the chunks before it. With an opaque `color` the result looks the same; with a translucent one the background vanishes in both the raster tile and the SVG `<pattern>`, since both read this geometry. Expected: keep the `bg` rect under the covering one (`[bg rect, color rect]`).
- evidence: read
- severity: low

## Files read
packages/renderer/src/paintKinds.ts
packages/renderer/src/paintResources.ts
packages/renderer/src/paintScratch.ts
packages/renderer/src/paintToLocalUnits.ts
packages/renderer/src/paintedBounds.ts
packages/renderer/src/patterns-builtin.ts
packages/renderer/src/patterns/commandPaint.ts
packages/renderer/src/patterns/imagePatternId.ts
packages/renderer/src/patterns/index.ts
packages/renderer/src/patterns/patterns-builtin.ts
packages/renderer/src/patterns/rasterizeTile.ts
packages/renderer/src/patterns/resolveImage.ts
packages/renderer/src/patterns/resolveSpec.ts
packages/renderer/src/patterns/test-utils/fakeOffscreenCanvas.ts
packages/renderer/src/patterns/tileGeometry.ts
packages/renderer/src/pbt.fixture.ts
packages/renderer/src/readPixels.ts
packages/renderer/src/rendererParts.ts
packages/renderer/src/rendererTypes.ts
packages/renderer/src/retain/RetainedSurfaces.ts
packages/renderer/src/retain/TileTextures.ts
packages/renderer/src/retain/bakeTile.ts
packages/renderer/src/retain/contentBounds.ts
packages/renderer/src/retain/movesWithView.ts
packages/renderer/src/retain/retainedKey.ts
packages/renderer/src/retain/tileCull.ts
packages/renderer/src/spriteSheet.ts
packages/renderer/src/state/GroupState.ts
packages/renderer/src/state/colorMatrix.ts
packages/renderer/src/strokeLengths.ts
packages/renderer/src/targetRect.ts
packages/renderer/src/test-seams.ts
packages/renderer/src/textBounds.ts
packages/renderer/src/textCommand.ts
packages/renderer/src/textLayout.ts
packages/renderer/src/textures/registerTexture.ts
packages/renderer/src/warmPrograms.ts
packages/renderer/src/warnOnce.ts

<!-- done: 2 findings, files read: 38 -->
