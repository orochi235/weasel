# Audit round 78 — renderer.part2 — reviewer findings

## warmPrograms leaks its WebGL context when building a program throws
- where: packages/renderer/src/warmPrograms.ts:39 (start)
- scenario: `start()` opens a context, then `FIRST_FRAME_SPECS.map((spec) => buildProgram(device, spec))`. If `buildProgram` throws (`gpu.createProgram` failing, e.g. the context lost under memory pressure right after creation, or `lookupUniforms`/`lookupAttributes` throwing), the exception goes up to `warmPrograms`'s bare `catch`, and `release()` (`WEBGL_lose_context.loseContext()`) never runs. Neither does the poll, so nothing else ever releases the context. A page holds a capped number of live WebGL contexts (about 16), so the browser may later evict a real renderer's context to make room. What should happen is that any throw after `getContext` releases the context. `new WebGLDevice(gl)` throwing leaks the same way.
- evidence: read (warmPrograms.ts, builtinPrograms.ts:73 `buildProgram`)
- severity: low

## A `'bounds'` paint of a lazily loaded kind is left unconverted while its loader runs
- where: packages/renderer/src/paintToLocalUnits.ts:25 (paintToLocalUnits), and the same at :60 (paintToBoundsUnits)
- scenario: a kind declared via `registerPaintDrawKindLoader` and not yet loaded. Calling `getPaintDrawKind(kind)` starts the load but returns `undefined`, so `paintToLocalUnits` returns the paint untouched with `units: 'bounds'`. `commandPaint`/`commandFill` hand that to the command. Painters memoize their commands, so when the kind lands, its own `toLocalUnits` never runs on a command built before it landed. The renderer then gets a `'bounds'` paint that it cannot place, because `spaceInverse` has no node box. The kind stays mis-placed until something else invalidates the painter's command. What should happen: a frame conversion on an unloaded kind should be marked unresolved, for example by returning something the caller drops or retries, rather than silently passing through as if it were converted. On the inverse path, `paintToBoundsUnits` returns a `'local'` paint unconverted, and an editor (GradientHandles / SceneGradientHandles) would store it as if it were box-relative.
- evidence: read (paintKinds.ts `getPaintDrawKind`, paintToLocalUnits.ts); the painter memoization is inferred from the comments in resolveImage.ts and commandPaint.ts
- severity: low

## Pose-less text keeps a `'bounds'` tile or image pattern in `'bounds'` units
- where: packages/renderer/src/textCommand.ts:157 (withPatternsResolved)
- scenario: `textCommand(x, y, 'hi', style, …, { fill: { kind: 'hatch', color, units: 'bounds', origin } })`. `withPatternsResolved` swaps the tile for a `texture` paint, and `patternPlacementOf` keeps `units: 'bounds'` and the box-relative `origin`. Unlike `runsInPoseFrame`, it never runs `paintToLocalUnits`. Its doc says "placing a tile needs no box", which is false for a `'bounds'` pattern, whose origin is relative to a box. The renderer gets a texture paint in units it cannot resolve. It should convert against the text's own box (x, y, width/maxWidth, height) or drop to `'local'` at the origin. The same applies to a `'bounds'` gradient on pose-less text, which passes through untouched.
- evidence: read (textCommand.ts, paintToLocalUnits.ts `isBoundsPattern`)
- severity: low

## `warnOnce` keys grow without bound, in production too, for data-derived keys
- where: packages/renderer/src/warnOnce.ts:7 (warnOnce)
- scenario: `warned.add(key)` runs whether or not `isDev()`. `meshPaint/bake.ts:103` keys on `mesh-color:${unread}`, which is user data, so a document or an animation feeding many distinct unparseable colors (generated strings, for example) adds one Set entry per string for the page's lifetime, and in production nothing is even printed. What should happen: skip the Set when not in dev, or cap it.
- evidence: read (warnOnce.ts; the caller found with Grep)
- severity: low

## The TileTextures pool is capped per size but not across sizes
- where: packages/renderer/src/retain/TileTextures.ts:96 (release)
- scenario: a tiled layer whose tile size follows zoom or dpr (for example a different `size` per zoom level) releases tiles of many sizes. Each size keeps up to `POOL_KEPT` (16) textures in `pool` forever. Nothing but `releaseAll` (dispose or context loss) prunes a size that is no longer baked, and `idle()` only drops the scratch buffer. GPU memory held by the pool grows by 16 textures for each distinct size ever released. What should happen: bound the pool in bytes or entries overall, or drop the pools of other sizes on `idle`.
- evidence: read
- severity: low

## `BakedTiles.begin` leaks its own scratch buffer if the opening clear throws
- where: packages/renderer/src/retain/bakeTile.ts:113 (BakedTiles.begin)
- scenario: `ownScratch(size)` adds a multisampled stencil target to `owned`, then `run([], true)` is called before the `TileBake` (and its `cancel`) exists. If that first `drawTile` throws (`contextFor`, `beginPass`, or `drawStream` throwing), the caller gets no handle to cancel. The target stays in `owned` and is counted in `bytes` until `releaseAll` on dispose or context loss. What should happen: free the scratch buffer in a catch around the opening run.
- evidence: read
- severity: low

## Unregistering a pattern texture through the public API strands its bitmap unclosed
- where: packages/renderer/src/patterns/resolveSpec.ts:94 (revive) / :78 (build)
- scenario: a consumer holding the `TextureHandle` that `resolvePatternSpec` or `hatch()` returned calls the public `unregisterTexture(handle)`. That function's doc says the image is the caller's to release, but the caller never had the bitmap: `build` made it and only the registry held it. The `cache` entry stays, and the next draw's `getTexture` revives the id: `build` rasterizes a fresh bitmap and registers it. The first bitmap is never `close()`d and its pixels wait on GC. In `evict`, closing the bitmap is the module's job, and it should be on this path too: either `revive` closes what it replaces, or an owned id's bitmap is closed when it leaves the registry.
- evidence: read (resolveSpec.ts, registerTexture.ts `unregisterTexture` / `getTexture`)
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

<!-- done: 7 findings, files read: 38 -->
