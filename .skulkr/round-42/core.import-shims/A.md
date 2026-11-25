I couldn't write `.skulk/out/findings.md` because permission to create it was refused, so the whole document is below. The frozen commit a31056c5f3adeb20052a681c149c8af782f0f7b5 isn't in this clone (`git cat-file` reports a bad object), so I read every file at HEAD 782733b19c instead.

# Audit round 42 — `core.import-shims`

## test-seams' header promises a paint-kind reset, an insert-dep source and an area hit test it no longer exports
- where: packages/core/src/import-shims/test-seams.ts:4-11 (module doc)
- scenario: the doc says the paint-kind registry is reset from here ("a test that registers into one has to be able to put it back"). It also says "The insert dep's source and the area hit test let a package's drawing tool commit and pick against a scene of its own." None of these seams exist in this file:
  - The paint-kind registry moved to `@weasel-js/paint-kinds` on 2026-11-16 (e4a8c4f0b4). Its own `test-seams` has `_resetPaintKindsForTests`.
  - The insert action and its dep moved to `@weasel-js/editing` (9566a40f92).
  - `hitTestRectForTests` was dropped on 2026-11-18 (3e32141ca6).

  A test that registers a paint kind and expects this entry to reset it finds no reset here, and the doc doesn't say where one lives.
- evidence: read (the module's exports against its doc; `git log -p` of the file; packages/paint-kinds/src/test-seams.ts:10)
- severity: low

## mesh.ts says core's package.json lists a `register` entry under `sideEffects`; there is none
- where: packages/core/src/import-shims/mesh.ts:1-2 (module comment)
- scenario: the comment justifies the side-effect import with "core's package.json lists this entry and `register` under `sideEffects`". But packages/core/package.json:23-27 lists only `*.css`, `./src/import-shims/mesh.ts` and `./dist/mesh.js`, and `exports` has no `./register` subpath. A maintainer adding a side-effectful shim would follow a convention that points at an entry that doesn't exist.
- evidence: read
- severity: low

## `ops.swap` is history's generic value-swap op, not a core op and not the new node swap
- where: packages/core/src/import-shims/ops.ts:2,14 (module doc; `createSwapOp as swap`)
- scenario: the doc says each name is "the same function as its `create…Op` in core's source". `swap` is not: it is `@weasel-js/history`'s `createSwapOp({ name, label, before, after, emit })`, which swaps an arbitrary value through a closure and never touches the scene. Since 78dd590020 (2026-11-19) the kit also has a node swap: the `swap` command and `swapOnDrop`, committed through `swapOps`. A consumer who writes `ops.swap(...)` next to `ops.reorder`/`ops.reparent` to swap two nodes gets an op with an unrelated argument shape whose `apply` ignores the adapter.
- evidence: read (packages/history/src/createSwapOp.ts:23; `git show --stat 78dd590020`)
- severity: low

## engine.ts' header still says it carries "the actions and tools such a host binds"
- where: packages/core/src/import-shims/engine.ts:1-2 (generated header, from scripts/gen-engine-entry.mjs:30)
- scenario: 9566a40f92 moved the move, resize, rotate, clone, insert, marquee, lasso and clear-selection actions to `@weasel-js/editing`. Since then the entry exports no action and no tool, only `useActionSet`/`useStandardDeps` and the behavior and dep types. A 3D host author who reads the header and looks here for the actions to bind finds none, because they live in editing. The header is generated, so the fix goes in the generator's `HEADER`.
- evidence: read (engine.ts exports; commit subject of 9566a40f92)
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

<!-- done: 4 findings, files read: 13 -->