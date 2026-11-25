`sameList` defaults to `Object.is`, so `NaN` repeats: from A, fixed e99ff312a8. Changing a default that core, ui, renderer and others call is a behavior change. Every consumer now reads `0` and `-0` as different elements. The controller's related-file run covers those consumers, but I didn't run it here.

`deepEqual` ignores an array's non-index own keys: from A, fixed 337bc943e1.

`ExtensionRegistry.register` treats a registered `undefined` as no registration: from A, fixed a1e8bd9657. This is my own call and is recorded in `docs/unruled.md`. Registering `undefined` now throws a `TypeError`, with no opt-in override, because `get` answers `undefined` for an id nobody holds and an override could never be told apart from no registration. This also makes the `theirs !== undefined` checks in `createLeans` sound, which A raised as part of the same finding.

A child's id re-registered through its parent in one tick moves in `entries()`: from B, fixed 374b3d4667.

A parent's one-tick release and register of a different value leaves the child shadowing the stale value: from B, fixed ef383d2ed7.

Extra defects found while fixing: none.

Checks:
- `npx vitest run --maxWorkers=1 packages/registry/src/sameList.test.ts`: pass (3 passed)
- `npx vitest run --maxWorkers=1 packages/registry/src/sameList.pbt.test.ts`: pass (2 passed)
- `npx vitest run --maxWorkers=1 packages/registry/src/valueStore.test.ts` (new file): pass (1 passed)
- `npx vitest run --maxWorkers=1 packages/registry/src/deepEqual.test.ts`: pass (7 passed)
- `npx vitest run --maxWorkers=1 packages/registry/src/deepEqual.pbt.test.ts`: pass (6 passed)
- `npx vitest run --maxWorkers=1 packages/registry/src/deepEqual.meta.pbt.test.ts`: pass (4 passed)
- `npx vitest run --maxWorkers=1 packages/registry/src/extensionRegistry.test.ts`: pass (21 passed)
- An earlier background run that piped two of the deepEqual files into grep together printed nothing and was stopped at its time limit. The runs listed above replaced it, each file on its own in the foreground, and all passed.
- `.skulkr/in/on-fleet typecheck 15 checks -- npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run lint -w @weasel-js/registry`: not run, because the package has no `lint` script. `npx eslint packages/registry/src` ran instead: pass, no output. The gate's root `npm run lint` also passed.
- `npm run check:changesets`: pass ("OK — 1438 changeset(s)"; none of the five new changesets has a warning)
- Working tree clean.

tally: 5 of 5 fixed, 0 extra fixed