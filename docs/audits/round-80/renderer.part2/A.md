## tileCull culls a group with its own composite by its children's box, though that composite changes the destination outside it
- where: packages/renderer/src/retain/tileCull.ts:30 (boxTree) and :51 (cullToTile)
- scenario: a tiled layer bakes a group with `composite: 'destination-in'` (or `'copy'`, `'source-in'`, anything `leavesUncovered` is false for) whose children cover only part of the page. `whole(cmd)` marks it whole, but its box comes from `contentBox([cmd], …)`, which is the children's painted box. A tile outside that box drops the group, so the destination there keeps what was drawn beneath, where drawing the group would have cleared or scaled it. `groupEffects.ts:45` composites such a group over the whole window, and `cullDrawCommands.ts:63` never culls a group with its own composite. The `whole()` doc comment even says the composite "changes the destination even where it drew nothing", but the box doesn't account for it. The box should be unbounded (or the enclosing clip) for a composite that does not leave uncovered pixels alone.
- evidence: read
- severity: medium

## commandBox bounds a group with its own composite by its children, where cullDrawCommands treats it as reaching everywhere
- where: packages/renderer/src/paintedBounds.ts:32 (commandBox, case 'group')
- scenario: `commandBox` / `listBox` back `contentBox`, `contentBounds` and `commandsBounds`. For a group with `composite: 'destination-out'` or `'copy'` they return the children's box. `cullDrawCommands` answers the same question the other way: it always keeps such a group (`isOwnComposite` → `return cmd`). `commandsBounds` therefore under-reports the rect a list with a clearing composite changes, and a caller sizing a bake or a dirty rect from it misses the cleared area. The same decision is made two ways in two places.
- evidence: read
- severity: medium

## rasterizeTile's `<canvas>` fallback always returns null, after drawing the whole tile
- where: packages/renderer/src/patterns/rasterizeTile.ts:11 (rasterizeTile)
- scenario: with no `OffscreenCanvas`, `new OffscreenCanvas` throws, so the code creates a DOM canvas, gets a 2D context, runs `opts.draw` and then returns `null`, because an `HTMLCanvasElement` has no `transferToImageBitmap`. The fallback the comment promises ("fall back to <canvas> for environments without it") never yields a bitmap. Each `resolvePatternSpec` miss allocates a canvas and rasterizes for nothing. The result should either use the canvas (e.g. register it as a source) or return null before drawing.
- evidence: read
- severity: low

## uninstallFakeOffscreenCanvas with no matching install deletes a real OffscreenCanvas
- where: packages/renderer/src/patterns/test-utils/fakeOffscreenCanvas.ts:82 (uninstallFakeOffscreenCanvas)
- scenario: an `afterEach` that uninstalls once more than it installed (say, a `beforeEach` that bailed before calling install) pops `undefined`. `before?.had` is falsy, so it runs `delete g.OffscreenCanvas`, removing the environment's real one (in the browser project) for every later test in the file. With an empty stack it should do nothing.
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

<!-- done: 4 findings, files read: 38 -->
