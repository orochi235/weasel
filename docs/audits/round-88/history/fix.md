Uncoalesced entry with Date/Map/Set/typed-array args restored as two arrays (A): not a defect. `serialize()` writes the same op object, and so the same `args`, into both halves. IndexedDB and `postMessage` store a structured clone, which keeps a shared reference shared, so `deepEqual` matches on `Object.is` first. A probe confirmed it: an entry with `Date` and `Map` args, sent through `structuredClone(serialize())` and restored, called `rebuildOp` once.

Entry ids past `Number.MAX_SAFE_INTEGER` collide after a restore (A): fixed d5188d2215. `restore` now treats a snapshot as malformed when any id, floor, fork point or `nextEntryId` is beyond ±2^52. This was a call nobody had ruled on, so it is recorded in `docs/unruled.md`.

A restored branching history over `historyLimit` keeps its branches over the cap until a push retires a redo stack (A): fixed 11d3736ce2. The branch cap now runs on every push, beside the undo-stack cap.

A coalesced entry whose ops repeat a `coalesceKey` is unwound against the wrong twins when a step throws (B): fixed 5b3c4d0047. The halves now pair by position only when no key repeats; otherwise a failed step unwinds through the `from`/`other` settle.

Checks:
- `npx vitest run --maxWorkers=1` on `history.restoreShape.test.ts`: pass (8). The new test failed before the fix.
- On `history.limit.test.ts`: pass (13). The new test failed before the fix.
- On `history.reorderedCoalesce.test.ts`: pass (7). Both new tests failed before the fix.
- On `history.branching.test.ts`, `forks.refill.test.ts`, `history.sharedHalves.test.ts`, `history.throwingStep.test.ts`, `history.coalesceAnchor.test.ts`, `history.test.ts` and `history.pbt.test.ts`: pass.
- `.skulkr/in/on-fleet typecheck 15 checks -- npm run checks:gate`: the first run failed on `check:size` (`createForks` at 121 lines). After a one-line trim folded into 11d3736ce2: "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/history`: unrun, because the package has no `lint` script. Instead, eslint on the six touched files: pass, and the gate's root `npm run lint`: pass.
- `npm run check:changesets`: pass.

tally: 3 of 4 fixed, 0 extra fixed