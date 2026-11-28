# renderer.part2 findings

## A `'bounds'` paint of a lazily loaded kind is passed through unconverted, and stays so after the kind lands
- where: packages/renderer/src/paintToLocalUnits.ts:25 (paintToLocalUnits), also :59 (paintToBoundsUnits)
- scenario: a kind declared with `registerPaintDrawKindLoader` that supplies `toLocalUnits`, used with `units: 'bounds'`. The first `commandPaint` call happens while the load is still running, so `getPaintDrawKind` returns `undefined` and the paint comes back as it went in, still `units: 'bounds'`, inside the draw command. Painters memoize their commands, so nothing rebuilds them once the kind registers. The renderer has no `'bounds'` handling at draw time (a grep of `packages/renderer/src/draw` finds none), so the paint is measured in the wrong space until the node changes. It should either convert once the kind lands, or mark the command as unresolved so it gets rebuilt.
- evidence: read
- severity: medium
- fix: packages/renderer/src/paintToLocalUnits.ts, packages/renderer/src/paintKinds.ts
- size: design
- cause: frame conversion silently skipped for an unloaded kind
- confidence: likely

## A loader that throws synchronously throws out of `getPaintDrawKind` on every lookup
- where: packages/renderer/src/paintKinds.ts:300 (startLoad), :213 (getPaintDrawKind)
- scenario: a `load` that throws before it returns a promise, for example `() => { if (!ok) throw …; return import(…) }`. Then `loader.load().then` throws inside `startLoad` before `loader.started` is set. `void startLoad(id).catch(...)` never gets a promise, so the throw escapes `getPaintDrawKind` into the draw, and the next frame calls `load` again. It should be caught and reported like a rejected load (`Promise.resolve().then(loader.load)`), and not retried.
- evidence: read
- severity: low
- size: line
- cause: sync throw not wrapped into the load promise
- confidence: likely

## An empty group running an unbounded effect is bounded as empty, so culling drops it
- where: packages/renderer/src/paintedBounds.ts:63 (grown), used from commandBox :35
- scenario: a group whose children paint nothing (an empty list, or text that lays out no glyph) runs an effect with `reach` unset, such as a generator pass that paints the whole buffer. `listBox` gives `EMPTY`, and `grown(EMPTY, Infinity)` returns `EMPTY` before it checks `Number.isFinite(by)`. `cullDrawCommands`, tile culling and retained `contentBox` therefore treat the group as painting nothing. The documented rule is that a group with an effect of unknown reach is bounded only by its clips, so the result should be `ANYWHERE`.
- evidence: read
- severity: low
- size: line
- cause: EMPTY short-circuit ahead of the infinite-reach check
- confidence: likely

## The `chunks` tile caps its count at s², which still hangs on a large tile
- where: packages/renderer/src/patterns/tileGeometry.ts:83 (tileGeometry, chunks)
- scenario: `{ kind: 'chunks', color, size: 4096, chunkSize: 0.01 }` gives `wanted` ≈ 5.9e10, which the cap reduces to `s*s` = 16.7M. That builds 16.7M or more shape objects (each wrapped copy pushes another), and `drawTileShapes` then makes that many `ellipse` calls: a hang and a memory spike while one tile resolves. The comment says the cap exists so the scatter "only hangs" no more. The cap needs to be a fixed bound, or the chunk size needs a floor (below about a pixel adds no coverage).
- evidence: read
- severity: low
- size: line
- cause: cap scales with tile area, not bounded
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
