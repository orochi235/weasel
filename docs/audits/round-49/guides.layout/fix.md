guides.layout: all 9 findings fixed, as 7 distinct fixes (two findings each appeared in both reports). Three behavior calls are recorded in `docs/unruled.md`.

- slots: a drop from outside could make two siblings trade places once `arrive` ran (A) — fixed 3ff13c5615
- pack `'grow'`: the container stopped following its content on a reorder, a child resize or a width change (A) — fixed 627fd3ac92. This adds an optional `LayoutStrategy.fit` hook to core, with a `minor` changeset because it is new API. The layout pass calls it wherever it called `childPoses`, and `createPerContainerStrategy` forwards it.
- tileGrid `'grow'`: in a multi-select drop into a full grid, the second member got a halved pitch, over a sibling (A) — fixed 7e71d0a2d7
- pack `'grow'`: a departure collapsed the container to `minHeight` when a remaining child was wider than it (A) — fixed c8231ffb80
- tileGrid offered empty cells, then `childPoses` compacted the dropped child out of them (B) — fixed 3ea978965a. Strict call, recorded in `docs/unruled.md`: a child keeps its cell, and only a departure closes gaps. editing's drag-out preview now runs the source container's `depart`, as the commit does; it had relied on `childPoses` compacting.
- pack `'grow'` did not resize on a reordering drop or a width change (B) — duplicate of the A pack-grow finding
- tileGrid `cols`/`rows` were not validated: 0 wrote `NaN` poses and a fraction laid cells off the grid (B) — fixed 20162516f6. Strict call, recorded in `docs/unruled.md`: counts round down, and under 1 or not finite gives a grid with no cells, which refuses every child (`gridSlots`' rule).
- slots: a drop from outside swapped two existing children (B) — duplicate of the A slots finding
- quadtree `maxDepth` was unbounded, with a 4^depth scan per child (B) — fixed be291da56f. Strict call, recorded in `docs/unruled.md`: `maxDepth` rounds down and is held to 0–7, and `NaN` gives the default 4. Free cells are now found by set lookup.

Extra: none. 1ccb3ad4d3 only shortens six of this round's changeset titles to pass `check:changesets`.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: pack.test.ts 9 passed, slots.test.ts 14 passed, perContainer.test.ts 6 passed, tileGrid.test.ts 20 passed, tileGrid.overflow.test.ts 24 passed, tileGrid.scene.test.ts 6 passed, quadtree.test.ts 8 passed. All pass.
- Also run: `packages/guides/src/layout/` 181 passed, `packages/editing/src/actions/move` 238 passed, `packages/core/src/core/scene/` 930 passed, `apps/site/demos/__tests__/layoutDemo.integration.test.tsx` 2 passed. All pass.
- `npm run checks:gate`: first run failed on `check:changesets` (six titles over 140 characters). After the fix: "checks:gate: all 32 passed". Pass.
- `npm run lint -w @weasel-js/{guides,core,editing}`: fail with `Missing script: "lint"`, because none of the three packages has a lint script. I ran eslint on every changed .ts/.tsx file instead: exit 0, pass.
- No browser test files touched.

tally: 9 of 9 fixed, 0 extra fixed