# Audit round 80 — renderer.part2 findings

## A group whose composite clears the destination is bounded by its children, so culling and tiles drop its clearing
- where: packages/renderer/src/paintedBounds.ts:33 (commandBox, case 'group'); used by packages/renderer/src/retain/tileCull.ts:28 (boxTree) and contentBox
- scenario: a group with `composite: 'destination-in'` (or `source-in`, `copy`, `destination-atop`) whose children sit in the left half of the canvas. `GroupDrawCommand.composite` documents that such a composite "covers the whole target inside the enclosing clip" and clears whatever the group left empty. `commandBox` ignores `composite` and returns the children's box. A tile or cull rect in the right half therefore sees no overlap: `cullToTile` (whose own `whole()` comment says the composite "changes the destination even where it drew nothing") drops the group, so that tile keeps content the group should have cleared. A box-based cull drops it the same way. Expected: for an operator that scales the destination by source alpha, the box is the enclosing clip's box, or unbounded.
- evidence: read (DrawCommand.ts:87-96 composite doc; commandBox has no composite branch)
- severity: medium

## textCommand / textCommandFromRuns map a `'bounds'` paint onto the wrong box for centered or right-aligned text with no width
- where: packages/renderer/src/textCommand.ts:178 (textBoxOf), called from resolveRunPaints:157
- scenario: `textCommand(100, 0, 'Hello', { align: 'center' }, undefined, undefined, undefined, { fill: { paint: linearGradient units 'bounds' } })`. With no `width` and no finite `maxWidth`, `TextDrawCommand.width` says `x` is then the line's midpoint (right edge for `right`/`end`). `textBoxOf` builds `{ x: cmd.x, width: bounds.width }`, which spans `[x, x+w]` while the glyphs span `[x−w/2, x+w/2]`. The gradient is shifted half a line right, and a full line for right-aligned text. `layoutRuns`' `bounds` has no `x` to correct it. Expected: the box starts where the aligned line starts.
- evidence: read (DrawCommand.ts:179-181; layoutRuns.ts:194 bounds is `{ width, height }` only)
- severity: medium

## createPaintResources.release stops at the first throwing release and drops the rest
- where: packages/renderer/src/paintResources.ts:17 (release)
- scenario: two paint kinds register `onRelease` callbacks on one renderer's resources, and the first throws (for example, `deleteTexture` on a handle already gone). `release()` sets `releases = null` before the loop. The throw leaves the loop, so the second kind's textures are never freed, and a later `release()` finds nothing to run. The renderer disposing or restoring its context leaks those textures and also sees the exception. Expected: every registered release runs once, whatever an earlier one does.
- evidence: read
- severity: low

## A lazily loaded paint kind's `'bounds'` paint passes through unconverted until the kind lands
- where: packages/renderer/src/paintToLocalUnits.ts:24 (paintToLocalUnits) and :57 (paintToBoundsUnits)
- scenario: a kind declared with `registerPaintDrawKindLoader`, first met in a frame. `getPaintDrawKind` starts the load and returns `undefined`, so `paintToLocalUnits` returns the fill still in `units: 'bounds'`. A painter that memoizes its commands (`commandPaint`/`commandFill`) keeps that unconverted paint after the kind loads, and `bind` then receives 0..1 bounds geometry as if it were local. `paintToBoundsUnits` on an edit path likewise returns the fill unchanged, with its units unconverted. Nothing invalidates those commands when the kind loads. Expected: conversion waits for, or is redone after, the kind's frame conversions are available.
- evidence: inference (read paintKinds.ts getPaintDrawKind; did not trace the painter memo's invalidation on kind load)
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

<!-- done: 4 findings, files read: 38 -->
