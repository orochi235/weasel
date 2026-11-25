Shared ops replayed twice by a failed step on a coalesced journal entry (A): fixed 291fb13e9a

Strict restore into a history without `branching` throws over branches it drops (A): fixed ec000100ab

BigInt or cyclic `version` makes `restore` throw a TypeError (A): fixed 77dd2c8702

Kept branches grow without bound under `historyLimit` (B): fixed 2c14e19d4e. My call, recorded in `docs/unruled.md`: `historyLimit` also caps the total entries in kept branches, and the oldest branch is evicted through `onEvict`.

Strict restore without `branching` throws over dropped branches (B): duplicate of A's restore finding, fixed ec000100ab

`snapshotFault` throws for a BigInt or circular `version` (B): duplicate of A's version finding, fixed 77dd2c8702

Restored branch whose `at` names no entry is kept forever (B): fixed 8243b063df. The shape check now refuses it. I updated a `history.test.ts` fixture that relied on such a branch.

`onEvict` doc lists the wrong set of evictions (B): fixed 0f58a8210d (doc only, no changeset)

Extras:

`String(err)` in the unwind, `onEvict` and goto-return log lines throws on a value with no text, such as `Object.create(null)`, which aborts the unwind and replaces the original error (sweep): fixed 86931a13ea

Checks:
- Every `packages/history/src/*.test.ts` file, one at a time with `--maxWorkers=1`: 41 of 41 pass, including the four I touched (`history.sharedHalves`, `history.branching`, `history.restoreShape` and `history.throwingStep`) and `history.test.ts`.
- `npm run checks:gate`: "checks:gate: all 33 passed". The first run failed `typecheck` and `typecheck:packages` on a test cast (TS2352); I fixed it and reran.
- `npm run lint -w @weasel-js/history`: fails with "Missing script: lint", because the package has no lint script. Instead I ran `npx eslint packages/history/src`: pass, no output.
- `npm run check:changesets`: OK, with no warnings on the new changesets. `npm run check:size`: "no file or function grew past its cap."

The tree is clean.

tally: 8 of 8 fixed, 1 extra fixed