# renderer.part2 findings

## A group whose effects have no stated reach is bounded as empty when its children paint nothing, not as anywhere
- where: packages/renderer/src/paintedBounds.ts:63 (grown), called from commandBox:37
- scenario: a group `{ kind: 'group', children: [], effects: [{ program: generatorFx }] }` (or children that all box EMPTY: a polygon with fewer than two coords, text that lays out no glyph), where the effect leaves `reach` unset because its output depends on where it lies in the buffer. `effectsReach` returns `Infinity`, but `grown` returns `box` unchanged when `box === EMPTY` before it checks for an infinite `by`, so the group boxes EMPTY. `cullDrawCommands`, `contentBox` (retained surfaces) and `boxTree`/`cullToTile` then drop it or give it an empty surface, though the effect runs over the whole buffer. `contentBox`'s own doc says effects that do not say how far they reach "are bounded only by the clips around them". It should come back as ANYWHERE (clipped by the group's clip).
- evidence: read
- severity: low
- fix: packages/renderer/src/paintedBounds.ts
- size: line
- cause: EMPTY short-circuit before the infinite-reach check
- confidence: likely

## A paint-kind loader that fails while it is displaced is never retried once it is uncovered
- where: packages/renderer/src/paintKinds.ts:296 (startLoad)
- scenario: `registerPaintDrawKindLoader('k', loadA)`. A lookup starts A's load. Then `registerPaintDrawKindLoader('k', loadB)` displaces A, and A's import rejects. When it succeeds while displaced, the `.then` branch clears `loader.started` so that A "loads again should it be uncovered". The rejection goes straight to `failed`, though: it logs `paint kind "k" failed to load` for a loader nobody is using, and `A.started` stays a rejected promise. Dispose B, and A is live again. Every `getPaintDrawKind('k')` and `warmPaintKinds(['k'])` gets that rejected promise back, so the kind never draws, although A was never asked to load while it was live. A `warmPaintKinds` started before the displacement also rejects, even though B (the live loader) loads fine. The success path and the failure path answer the displaced case two different ways.
- evidence: read
- severity: low
- size: function
- cause: displaced check only on the fulfilled branch
- confidence: sure

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
