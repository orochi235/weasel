## shaderBox bounds a custom shader from its GLSL alone, so a WGSL program with its own vertex stage is under-bounded on WebGPU
- where: packages/renderer/src/paintedBounds.ts:61 (shaderBox)
- scenario: a program registered with `glsl: { frag }` (no `vert`) and `wgsl: { vert, frag }`, drawn by a renderer on WebGPU. `shaderBox` reads only `glsl`, sees no `vert`, and returns `cmd.bounds`; but the WebGPU backend draws the WGSL `vertex`, which can place geometry anywhere. Culling (`cullDrawCommands`), retained-surface bounds (`contentBox`) and tile culling then drop or clip pixels the shader really paints. Likewise a WGSL fragment reading `@builtin(position)` without the frag-origin uniform is never caught. A WGSL-only program (no `glsl`) goes to ANYWHERE, so the question "can this shader paint outside `bounds`?" is answered from one language whatever backend draws it. Should answer for the backend in use, or conservatively for either language (any `vert` in either → null).
- evidence: read
- severity: medium
- fix: packages/renderer/src/paintedBounds.ts
- size: function
- cause: bound decided from GLSL only
- confidence: likely

## A paint-kind loader that throws synchronously escapes getPaintDrawKind on every lookup
- where: packages/renderer/src/paintKinds.ts:316 (startLoad)
- scenario: `registerPaintDrawKindLoader('k', () => { throw new Error('x') })` (or any non-async loader that throws before returning a promise). `getPaintDrawKind('k')` calls `void startLoad(id).catch(() => {})`; `loader.load()` throws before `.then`, so the throw propagates out of `startLoad` and out of `getPaintDrawKind` into the painter/renderer, and `loader.started` is never set, so every later lookup (every frame) throws again. Should be caught as a failed load (`Promise.resolve().then(() => loader.load())`), logged once and cached like an async rejection.
- evidence: read
- severity: low
- fix: packages/renderer/src/paintKinds.ts
- size: line
- cause: sync loader throw not wrapped in the promise
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
