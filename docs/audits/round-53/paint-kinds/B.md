I wasn't given permission to write `.skulk/out/findings.md`, so the full findings document is below.

## A lazily loaded kind that fails `registerPaintKind`'s stopsOf/fromStops check never registers and logs nothing
- where: packages/paint-kinds/src/paintKinds.ts:159 (registerPaintKindLoader → registerPaintKind), with packages/renderer/src/paintKinds.ts:280-287 (startLoad)
- scenario: `registerPaintKindLoader('wash', async () => ({ ...entry, stopsOf }))`, with `stopsOf` and no `fromStops`. The first `getPaintKind('wash')` starts the load. The loader resolves, `register` calls `registerPaintKind`, which throws. That throw happens inside the `.then` fulfillment callback, so the `failed` handler in the same `.then` never sees it, and no `console.error` fires. `getPaintDrawKind` swallows the rejection with `.catch(() => {})`, and `started` caches it, so the kind silently stays unknown on every later frame. The same entry registered eagerly throws a clear error. It should log, as a failed load does.
- evidence: read
- severity: low

## `getPaintKind` reads its own registry but decides whether to load from the renderer's, so the two can disagree and the editor half never loads
- where: packages/paint-kinds/src/paintKinds.ts:170-175 (getPaintKind)
- scenario: a kind `foo` has a loader declared through `registerPaintKindLoader`, and its draw half is also registered directly with `@weasel-js/renderer`'s public `registerPaintDrawKind` (for example, by a renderer-only module that loads first). `getPaintKind('foo')` misses in the paint-kinds registry and calls `getPaintDrawKind('foo')`. That call finds the renderer entry and never starts the load. `startLoad` would also skip `register` under `KINDS.has(id)`. So `getPaintKind('foo')` and `usePaintKind('foo')` return `undefined` forever, and `foo` never appears in `listPaintKinds`, even though a loader for it exists.
- evidence: read
- severity: low

## A gradient seeded from white written as anything other than `#ffffff…` ramps white to white
- where: packages/paint-kinds/src/paintKinds.ts:96-99 (twoStopRamp)
- scenario: `getPaintKind('linear-gradient').seed('#fff')` or `seed('white')`. `isWhite` only matches the first 7 characters against `#ffffff`. `#FFFFFF` passes because of `toLowerCase`, but `#fff` and `white` do not, so `isWhite` is false and the far stop is `#ffffffff`. The result is a flat white gradient. PaintInput passes `colorOf(shown)` straight in, and a solid's `color` is a consumer string. The contrasting end should be black for any color that parses as white.
- evidence: read
- severity: low

## `meshGradientKind`'s doc names a module `./registerMesh` that does not exist
- where: packages/paint-kinds/src/meshKind.ts:13 (meshGradientKind doc)
- scenario: a reader looking for the eager registration follows the doc to `./registerMesh` and finds nothing. The module that registers the kind is `./mesh`, published as `@weasel-js/paint-kinds/mesh`.
- evidence: read
- severity: low

## Files read
packages/paint-kinds/src/icons.gen.ts
packages/paint-kinds/src/icons.table.ts
packages/paint-kinds/src/index.ts
packages/paint-kinds/src/mesh.ts
packages/paint-kinds/src/meshKind.ts
packages/paint-kinds/src/meshKindLazy.ts
packages/paint-kinds/src/paintKindEntry.ts
packages/paint-kinds/src/paintKinds.ts
packages/paint-kinds/src/react.ts
packages/paint-kinds/src/svgNative.ts
packages/paint-kinds/src/test-seams.ts
packages/paint-kinds/src/tileSvg.ts
packages/paint-kinds/src/usePaintKinds.ts

<!-- done: 4 findings, files read: 13 -->