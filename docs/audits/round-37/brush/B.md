## A shared brush size is held to the first sharing tool's bounds, not each tool's, in a prefs-backed host
- where: packages/brush/src/brushSize.ts:7 (shareBrushSize doc), with packages/brush/README.md ("Each tool reads it held to its own bounds")
- scenario: share `radiusPx` under `BRUSH_SIZE_PX` between a brush with `max: 30` and one with `max: 400`, kept by `prefsToolOptionValues` (as apps/draw does). `toolOptionsPrefs` (packages/routing/src/tools/toolOptionPrefs.ts:47) puts one leaf in the `shared` group, the first tool's, and the prefs store's `values()` tree repairs every value against that leaf (packages/prefs/src/store.ts:207, `resolveHeld`). If the max-30 tool comes first, the max-400 tool writing 120 reads back 30. The other order puts the max-400 tool's default on the small one. Only `createToolOptionValues` stores raw values, so the doc's promise holds only there, and brushSize.test.ts only covers that store. Expected: each tool reads the shared value held to its own bounds, as documented, whatever store the host uses.
- evidence: read
- severity: medium

## shareBrushSize defaults every size to the screen-pixel key whatever unit the option is in
- where: packages/brush/src/brushSize.ts:10 (shareBrushSize)
- scenario: a brush whose size option is in world units (its leaf's `unit` is not `PX_UNIT`) called as `shareBrushSize(OPTS)` gets `{ [option]: 'brushSizePx' }`, so its world-unit size and the pixel brushes' sizes are one value read in different units. The function's own doc says that case needs a key of its own, but it doesn't check the leaf's `unit` (which it could read from `options.prefs`), and it doesn't warn. An empty `key` (`''`) also comes back as a share that `toolOptionSlot` treats as falsy, so that tool's size quietly stays per-tool. Expected: refuse or warn on a non-px leaf under the px key, and on an empty key.
- evidence: read
- severity: low

## Files read
packages/brush/src/brushSize.ts
packages/brush/src/index.ts

<!-- done: 2 findings, files read: 2 -->
