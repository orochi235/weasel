I couldn't write `.skulk/out/findings.md` because the permission was denied, so the whole findings document is below.

## The `@weasel-js/core/ops` package doc's example commits through an API that does not exist
- where: packages/core/src/import-shims/ops.ts:7 (package doc)
- scenario: the doc shows `ctx.applyBatch([ops.insert({ node }), ops.setPose({ id: node.id, from, to })])`. No `ctx` type has `applyBatch`: neither `InvocationCtx` nor anything in `@weasel-js/routing` declares it (grep finds no definition outside the scene). The only `applyBatch` is `Scene.applyBatch(ops, label, adapter)` (core/scene/types.ts:277). A reader who moves the call onto the scene with the doc's one argument gets `label` and `adapter` undefined, and `createInsertOp`'s `apply` then calls `a.getChildren` on `undefined` and throws a TypeError (core/ops/create.ts:44-47). The repo's CLAUDE.md names `ctx.applyBatch([ops.insert(...)])` as the dead pattern. The example should commit with `commitOps(...)` or `scene.applyBatch(ops, label, defaultCommitAdapter(scene))`.
- evidence: read
- severity: medium

## `ops.ts` says every factory is core's own `create…Op`, but `ops.swap` is history's generic value swap
- where: packages/core/src/import-shims/ops.ts:2-3, 13 (package doc, `swap` export)
- scenario: the doc reads "each the same function as its `create…Op` in core's source". `swap` re-exports `createSwapOp` from `@weasel-js/history` (packages/history/src/createSwapOp.ts). That op swaps a caller-held value through an `emit` callback and never touches a scene adapter, unlike every other member of the namespace. Editing's `presets.swap` and `groups.swap` mean node swapping (packages/editing/src/actions/swap/), so a reader who takes the doc at its word expects `ops.swap` to swap nodes. It needs `{ name, label, before, after, emit }`.
- evidence: read
- severity: low

## The test-seams doc promises a paint-kind registry reset that the entry does not export
- where: packages/core/src/import-shims/test-seams.ts:4-6 (package doc)
- scenario: the doc says the paint-kind and stroke-marker registries are global state that a test "has to be able to put back", and that these seams provide it. The only reset seams exported are `_resetMarkersForTests` (stroke) and `_resetContentHandlersForTests`. The paint-kind reset is `_resetPaintKindsForTests` in `@weasel-js/paint-kinds/test-seams`, where it went with the registry (e4a8c4f0b4). A package test following the doc finds nothing to import here.
- evidence: read
- severity: low

## `mesh.ts` says core's manifest lists a `register` entry under `sideEffects`; there is none
- where: packages/core/src/import-shims/mesh.ts:1-2 (header comment)
- scenario: the comment says core's package.json lists "this entry and `register` under `sideEffects`". The manifest's `sideEffects` is `*.css`, `./src/import-shims/mesh.ts` and `./dist/mesh.js`, and core has no `register` entry in `entries.ts` or `exports`. A maintainer adding a side-effecting entry looks for a `register` precedent that does not exist.
- evidence: read
- severity: low

## test-seams exports the same fixture functions under two names each
- where: packages/core/src/import-shims/test-seams.ts:29 and 48 (`gridSource` as `gridSnapSourceForTests` and `gridSourceForTests`; `sessionDep` as `snapSessionDepForTests` and `sessionDepForTests`), 34 and 44 (`runs`, `tally` and `timeoutFor` as `pbtRunsForTests`/`runsForTests`, `pbtTallyForTests`/`tallyForTests`, `pbtTimeoutForTests`/`timeoutForForTests`)
- scenario: each pair is one function from the same module (`domains/snap/testing/sessionDep`, `interactions/actions/pbtScene.fixture`), imported once through the bare path and once through `../`. Packages' tests split between the two names, and renaming or dropping one leaves the other behind. Earlier rounds removed exactly this kind of alias seam (`iconsForTests` in 0e07ccb3b8, `hitTestRectForTests` in 3e32141ca6).
- evidence: read
- severity: low

## Files read
packages/core/src/import-shims/engine.ts
packages/core/src/import-shims/groups.ts
packages/core/src/import-shims/icons.ts
packages/core/src/import-shims/json.ts
packages/core/src/import-shims/math.ts
packages/core/src/import-shims/mesh.ts
packages/core/src/import-shims/ops.ts
packages/core/src/import-shims/patterns-builtin.ts
packages/core/src/import-shims/presets.ts
packages/core/src/import-shims/render-worker.ts
packages/core/src/import-shims/renderer.ts
packages/core/src/import-shims/routing.ts
packages/core/src/import-shims/test-seams.ts

<!-- done: 5 findings, files read: 13 -->