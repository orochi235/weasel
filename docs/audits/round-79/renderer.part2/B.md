# Audit round 79 — renderer.part2 findings

## A loader uncovered by disposing the one that displaced it mid-load never loads its kind
- where: packages/renderer/src/paintKinds.ts:276 (startLoad), with registerPaintDrawKindLoader's disposer at :256
- scenario: `registerPaintDrawKindLoader('k', L1)`; a frame looks `'k'` up, so L1's load starts. Before it settles, `registerPaintDrawKindLoader('k', L2)` displaces it. L1 resolves, sees it is no longer live and hands off to `startLoad` for L2, which loads and registers the kind. `L1.started` is kept as a resolved promise. Now dispose L2: L1 is uncovered and L2's kind is dropped. On every later lookup `getPaintDrawKind('k')` misses and calls `startLoad`, which returns L1's settled `started` and never calls L1's loader again. The kind stays unregistered for good, and `warmPaintKinds(['k'])` resolves as if it were loaded, which breaks its "resolves once every kind is registered" contract. What should happen: the uncovered loader loads, as the doc says ("uncovering whatever it displaced"). The fix is to clear `started` when a load settles without registering anything because the loader was displaced.
- evidence: read
- severity: medium

## Two kinds declaring one program id: the later one silently takes it, and disposing it deletes the program the other draws with
- where: packages/renderer/src/paintKinds.ts:163 (holdPrograms) and :208 (registerPaintDrawKind disposer)
- scenario: kind `"a"` declares program `p`, and then kind `"b"`, a different kind id, also declares `p` with a different source. `holdPrograms` registers with `replace: true`, so `"b"` replaces `"a"`'s `p` with no conflict raised, and `"a"` starts drawing with `"b"`'s shader. `"a"`'s release becomes a no-op (extensionRegistry: "a release after a replacement does nothing"). Disposing `"b"` runs `releasePrograms(b)`, which removes `p` entirely. The re-hold only runs for `live`, the kind under the same id `"b"`, so `"a"` is left naming a program that no longer exists and draws nothing. `replace: true` is right for an override of the same kind id. Across kind ids it should throw the `ExtensionConflictError` that a plain `registerProgram` collision does, or the disposer should restore the previous holder.
- evidence: read (registry semantics read in packages/registry/src/extensionRegistry.ts)
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
