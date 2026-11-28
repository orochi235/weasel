## A lazily loaded paint kind's `'bounds'` paint passes through unconverted until the kind lands
- where: packages/renderer/src/paintToLocalUnits.ts:25 (paintToLocalUnits)
- scenario: a kind declared with `registerPaintDrawKindLoader` and not yet loaded; a node paints `{ kind: 'mykind', units: 'bounds', ... }`. `getPaintDrawKind` starts the load and returns `undefined`, so the paint comes back as it was, still in `'bounds'` units, and `commandPaint` hands that to the draw command. Painters memoize commands on the node, so once the kind lands the renderer draws a `'bounds'` paint it expects in `'local'`, misplaced, until something else invalidates the node's commands. It should either wait for the kind (draw nothing) or redo the conversion once the kind registers.
- evidence: read
- severity: medium
- fix: packages/renderer/src/paintToLocalUnits.ts, packages/renderer/src/patterns/commandPaint.ts
- size: function
- cause: conversion silently skipped for unloaded kind
- confidence: likely

## An effect with no stated reach on a group that paints nothing is bounded as empty, so culling drops it
- where: packages/renderer/src/paintedBounds.ts:69 (grown)
- scenario: a group whose children's box is `EMPTY` (no children, or only text that lays out nothing) carries an effect with unknown (infinite) reach, such as a generator or backdrop shader that writes pixels wherever its surface lies. `grown` returns `EMPTY` before it checks `!Number.isFinite(by)`, so `commandBox` reports the group as painting nothing, and the cull and the retained `contentBox` drop it or give it an empty surface. An unbounded reach should give `ANYWHERE`, as it already does for a non-empty box.
- evidence: read
- severity: low
- size: line
- cause: early return ordered before the infinite-reach check
- confidence: likely

## Tile spec ids serialize NaN/Infinity as `null`, so an evicted tile revives with different geometry
- where: packages/renderer/src/patterns/resolveSpec.ts:47 (specId), :116 (revive)
- scenario: `{ kind: 'hatch', color: '#000', lineWidth: NaN }`. The first build draws no lines (`!(NaN > 0)`), and its id holds `"lineWidth":null`. Once it is evicted past `PATTERN_TILE_CACHE_LIMIT`, or unregistered, and a held handle draws, `revive` parses `lineWidth: null`, and `null ?? 1` draws 1px lines. The same handle shows two different tiles. `radius: NaN` (no dots, then 1px dots) and `density: NaN` (no chunks, then the 0.35 default) behave the same way. NaN and an explicit `null` also share one cache id.
- evidence: read
- severity: low
- size: function
- cause: JSON id is lossy for non-finite numbers
- confidence: sure

## `textBoxOf` spreads every line into `Math.min`, which throws for very long text
- where: packages/renderer/src/textCommand.ts:174 (textBoxOf)
- scenario: `textCommandFromRuns` with a `'bounds'` gradient fill, no `width`, no finite `maxWidth`, and text of more than ~100k lines (a log or data dump). `Math.min(...lines.map(...))` exceeds the engine's argument limit and throws `RangeError`. A loop would not.
- evidence: read
- severity: low
- size: line
- cause: spread of unbounded array into call arguments
- confidence: likely

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
