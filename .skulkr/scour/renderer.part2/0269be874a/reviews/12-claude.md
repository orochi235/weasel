# renderer.part2 findings

## A tile spec's cache id collides on NaN/Infinity vs null, and a revived tile is rebuilt with different fields than the one it replaced
- where: packages/renderer/src/patterns/resolveSpec.ts:46 (specId), :120 (revive)
- scenario: `specId` serializes with `JSON.stringify`, which writes `NaN`, `Infinity` and `null` all as `null`. So `{ kind: 'dots', color, radius: NaN }` (no shapes, since `!(r >= 0)` in `tileGeometry`) and `{ kind: 'dots', color, radius: null }` from JSON (`null ?? 1` gives 1-px dots) share one id, and whichever resolves first is what both draw. Also, after the NaN tile is evicted (more than 256 distinct specs) or unregistered, `revive` parses the id back to `radius: null` and rasterizes dots, so a handle that drew nothing now draws dots. `chunks` with `density: NaN` does the same: it draws an empty tile, but revived it draws at the default 0.35. The id should encode non-finite numbers distinctly, or `build` should normalize the spec so the cached tile and the revived tile come from identical fields.
- evidence: read
- severity: low
- fix: packages/renderer/src/patterns/resolveSpec.ts
- size: function
- cause: lossy JSON key that revive also uses as the source of the spec
- confidence: sure

## A 'bounds' conic gradient keeps its angle when mapped onto a non-square box
- where: packages/renderer/src/paintToLocalUnits.ts:47 (paintToLocalUnits), :79 (paintToBoundsUnits)
- scenario: take a conic gradient with `units: 'bounds'` and `angle: π/4` on a 200×100 box. In the box's own frame (SVG objectBoundingBox), its start ray points along bounds direction (1, 1), which is local direction (200, 100), about 26.6°. `paintToLocalUnits` copies `angle` through unchanged, so the gradient starts at 45°: the start ray sits about 18° off from where it should be, and it moves again whenever the box's aspect ratio changes. Linear gradients get the same treatment through `keepBands`, and radial radii are scaled, but a conic's angle is never mapped (`atan2(h·sin a, w·cos a)` going in, and the inverse coming back).
- evidence: read
- severity: low
- fix: packages/renderer/src/paintToLocalUnits.ts
- size: line
- cause: conic angle not transformed by the box scale
- confidence: likely

## textBoxOf spreads every laid-out line into Math.min, which throws on very long text
- where: packages/renderer/src/textCommand.ts:174 (textBoxOf)
- scenario: a text command built by `textCommandFromRuns` or `textCommandFromRunsInto` with a non-solid `'bounds'` paint and no `width` lays out its runs and calls `Math.min(...lines.map((l) => l.x0))`. A text with more lines than the engine's argument limit (about 10⁵ in V8, e.g. a long log pasted into a node) throws `RangeError: Maximum call stack size exceeded` while the command is built, where a plain loop would return the minimum.
- evidence: read
- severity: low
- size: line
- cause: argument spread over an unbounded array
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
