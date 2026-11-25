# Audit round 69 — area `editing` — findings

## A boolean result keeps its source's geometry-bound data (`generator`, `skin`, `constraints`, `warp`, `representation`, per-anchor data), unlike every path command
- where: packages/editing/src/deps/booleans.ts:75-76 (useBooleansAdapterDepSource → createPathNode)
- scenario: union a star (data carries `generator: { kind: 'star', … }`) with a rect, or Divide a path carrying `constraints`/`skin`/per-anchor widths. With no stroke folded in (`paint` undefined), the new node's data is `{ ...source.data, path: stored.path }`, so it keeps the star `generator` (the property panel's `showIf: data.generator.points` rows still show Points/Inner ratio for a shape that is no longer a star), and keeps `constraints`/`skin`/`warp`/`representation` and per-anchor data that index anchors the boolean result does not have. With `paint`, the same fields survive through `rest`. The path commands answer the same question — "a node minted from a source with new geometry" — in `packages/core/src/interactions/actions/pathCommands/pathNodes.ts:75` by `withoutGeometryBoundData(withoutShapeGenerator(...))` plus `withAnchorDataFitting`; the boolean adapter should do the same (two answers to one decision).
- evidence: read (deps/booleans.ts 71-84; pathNodes.ts 69-77; pathEditExtension.ts 210 `GEOMETRY_BOUND_DATA = ['skin','constraints','warp','representation']`; shapeGenerator.ts settle/regenerate guard only on edit)
- severity: medium

## `insert` dep's `build` silently drops a factory's `batch` and `inserted` hooks that `commit` honors
- where: packages/editing/src/deps/insert.ts:219-222 (useInsertDepSource → build)
- scenario: a consumer `insertNodeFactories['path']` returns `{ data, batch, inserted }` (e.g. a node opened for editing on arrival, its first edit joining the insert's undo step). Through `commit` the batch options are applied (`sc.batch(label, apply, built.batch(id))`) and `inserted(id, registry)` runs. Through `build` — which `InsertDep` documents as "what `commit` would apply, unapplied", and which the pen uses to join two paths — `make` returns both hooks and `build` discards them (`{ id: made.id, ops: made.ops }`), so the caller applying those ops gets no batch options and the `inserted` hook never runs: the same insert behaves differently by which entry point minted it. `build` should hand the hooks back (or the dep should run `inserted` after the caller applies).
- evidence: read (insert.ts 208-241; core insertFactories.ts 35-39 `batch`/`inserted` docs; core insertDeps.ts 92-96 `build` doc)
- severity: low

## Files read
packages/editing/src/actionGroups.ts
packages/editing/src/actionParamSchema.ts
packages/editing/src/booleans/booleans.ts
packages/editing/src/booleans/commit.ts
packages/editing/src/booleans/custom.ts
packages/editing/src/booleans/index.ts
packages/editing/src/booleans/operands.ts
packages/editing/src/booleans/pieces.ts
packages/editing/src/booleans/placement.ts
packages/editing/src/booleans/useBooleans.ts
packages/editing/src/booleans/useBooleansAdapter.ts
packages/editing/src/clipboard/clipboardOps.ts
packages/editing/src/clipboard/index.ts
packages/editing/src/clipboard/materializePaste.ts
packages/editing/src/clipboard/osClipboard.ts
packages/editing/src/clipboard/useClipboard.ts
packages/editing/src/clipboard/wireFormat.ts
packages/editing/src/deps/areaSelect.ts
packages/editing/src/deps/booleans.ts
packages/editing/src/deps/insert.ts
packages/editing/src/deps/lassoSelect.ts
packages/editing/src/deps/presetDeps.tsx
packages/editing/src/deps/resizePolicy.ts
packages/editing/src/engine.ts
packages/editing/src/engineStandardActions.ts
packages/editing/src/groups.ts
packages/editing/src/icons.gen.ts
packages/editing/src/icons.table.ts
packages/editing/src/index.ts
packages/editing/src/ingest/ghost.ts
packages/editing/src/ingest/imageHandler.ts
packages/editing/src/ingest/kitHandlers.ts
packages/editing/src/ingest/svgHandler.ts
packages/editing/src/ingest/weaselJsonHandler.ts
packages/editing/src/integration/core/canvas/SceneCanvas/kitActionParams.allow.ts
packages/editing/src/integration/core/canvas/SceneCanvas/kitSweep.fixture.tsx
packages/editing/src/integration/interactions/actions/pbt.fixture.ts
packages/editing/src/namedPresets.ts
packages/editing/src/presets.ts
packages/editing/src/selection/useSelection.ts
packages/editing/src/test-seams.ts
packages/editing/src/useStandardActions.ts

<!-- done: 2 findings, files read: 42 -->
