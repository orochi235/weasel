## A group with an unbounded effect and nothing painting inside it is bounded as empty, so culling and retention drop its effect output
- where: packages/renderer/src/paintedBounds.ts:73 (grown), used from commandBox's `'group'` case (line 34)
- scenario: a group with `effects: [{ program, /* no reach */ }]` whose children paint nothing (an empty `children`, or only text that lays out no glyph, which `commandBox` boxes as `EMPTY`). `effectsReach` is `Infinity`, which the `Effect.reach` docs define as "bounded only by the buffer", but `grown` returns `box` unchanged when it is `EMPTY` before it checks `Number.isFinite(by)`, so the group's box is `EMPTY`. `cullDrawCommands` (`boxMisses(commandBox(...))`) then drops the group, and `contentBox` gives a retained surface an empty rect. A pass that writes pixels from a transparent input (a fill, noise, a vignette) draws when the group is drawn straight through and vanishes once it is culled or retained. With an unset reach the box should be `ANYWHERE` whatever the children cover.
- evidence: read
- severity: low
- fix: packages/renderer/src/paintedBounds.ts
- size: line
- cause: EMPTY short-circuit before the infinite-reach check
- confidence: likely

## warmPaintKinds can resolve with the kind still unregistered when its loader is disposed during the load
- where: packages/renderer/src/paintKinds.ts:300 (startLoad, displaced branch)
- scenario: `warmPaintKinds(['foo'])` starts foo's only loader, then its disposer runs before `load()` settles. When the load resolves, `LOADERS.get(id) !== loader` and there is no live loader, so the branch returns `undefined` and the promise `warmPaintKinds` returned resolves, although its docs promise "Resolves once every kind is registered" and say it rejects "for a kind that is neither registered nor loadable". A caller awaiting the warm before its first frame then draws blanks for `foo` with no error. The same branch handles a *rejected* load differently: `failed` rethrows even though the loader was displaced, so the warm rejects even when a live loader that would have succeeded displaced it, and that loader is never started.
- evidence: read
- severity: low
- fix: packages/renderer/src/paintKinds.ts
- size: function
- cause: displaced-loader handling only on the success path; no recheck of registration
- confidence: likely

## A displaced loader whose load failed is never retried once it is uncovered
- where: packages/renderer/src/paintKinds.ts:291 (startLoad)
- scenario: loader A for `foo` starts and is displaced by loader B before it settles. If A's load rejects, `loader.started` keeps the rejected promise (only the success branch clears it, with the comment "this one loads again should it be uncovered"). If B is disposed later, A is uncovered, and every lookup of `foo` returns A's cached rejection. `foo` never loads, although A's failure happened while it was not the live loader and its result was never used. A rejection that happens after displacement should clear `started` the same way a success does.
- evidence: read
- severity: low
- fix: packages/renderer/src/paintKinds.ts
- size: line
- cause: `started` cleared on the displaced success path only
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

<!-- done: 3 findings, files read: 38 -->
