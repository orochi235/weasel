## A text command refilled in place under a retained group keeps compositing its old pixels
- where: packages/renderer/src/retain/retainedKey.ts:57 (sameKey), with packages/renderer/src/textCommand.ts:73 (textCommandFromRunsInto) and packages/renderer/src/retain/movesWithView.ts:20 (movesWithView memo)
- scenario: a HUD keeps one `TextDrawCommand` in a group carrying `retain` and rewrites it every frame with `textCommandFromRunsInto`, as that function's doc invites ("anything still holding `cmd` sees the new text"). The group's `children` array is the same object, so `sameKey` (`a.children === b.children`) matches and `RetainedSurfaces.lookup` returns `kept`: the old text is composited forever. The frame stamp (`WeaselRenderer.ts:208`) holds glyph/text-engine/texture generations but no refill counter, though `textBounds.ts` already keeps one (`noteTextRefill`) for exactly this and its layer-box cache honors it. Two answers to "did this text change": the bounds cache says yes, the retained key says no. The same staleness hits `movesWithView`'s per-array memo, which keeps its verdict after a refill swaps a run's paint for a screen-unit gradient. Should: a refill invalidate the retained key (e.g. fold the refill counter into the stamp or key).
- evidence: read
- severity: medium

## A paint kind declaring a program id that `registerProgram` already holds silently replaces it, and disposing the kind deletes it outright
- where: packages/renderer/src/paintKinds.ts:162 (holdPrograms), 174 (releasePrograms)
- scenario: an app calls `registerProgram('glow', srcA)` for a shader command, then registers a paint kind declaring `programs: { glow: srcB }`. The conflict check only walks `PROGRAMS_HELD` (other kinds), so nothing throws; `programSourceRegistry.register(..., { replace: true })` overwrites `srcA` and the shader command now draws with the kind's source. When the kind is disposed, its release (the extension registry's newest holding) deletes `glow` entirely, so the app's shader command draws nothing and warns about a missing program. `registerProgram` itself throws `ExtensionConflictError` for the same collision without `replace`, and the kind's doc promises a conflict throw only for another kind. Should: throw (or at least not replace) when the id is held by a non-kind registration with other source.
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
