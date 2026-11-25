- failed undo of an entry whose halves share ops replays coalesced ops after the shared one (A): fixed 2b466f92b7. Redo had the mirror fault when the shared op comes first, and the same commit fixes that too.
- a listener hearing a nested commit cannot commit or cancel the enclosing journal (A): fixed 61476b9956
- `restore`/`switchBranch` spread whole stacks into call arguments (A): fixed 7b85460f4b. The test exercises the new `refill` helper at 3M entries. I saw the old code throw `RangeError` at 3M entries through `restore`, but didn't keep that as a test because it takes about 10 s. At 300k it passed under vitest.
- `Journal.commit` doc promises one labeled entry, but a keyed session folds into the parent's top entry (A): fixed 5f56a04ff1. The folding is intended and `journal.recordEntry.test.ts` already tests it, so the fix is to the docs (`Journal.commit` and `HistoryStep`'s `'push'` line).
- `snapshotFault` accepts branches no walk from the stacks reaches, and an entry id equal to the floor (B): fixed fef3151b03
- `HistoryStep` `'coalesce'` doc says `ops` are what the push brought (B): fixed 149ba7a2c5. Docs only.

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file: `history.reorderedCoalesce.test.ts` pass (5), `journal.nested.test.ts` pass (11), `forks.refill.test.ts` pass (2), `history.restoreShape.test.ts` pass (7). All of `packages/history`: pass (259).
- `npm run checks:gate`: pass, "checks:gate: all 33 passed". The first run failed 3 of 33 (`check:listener-sets`, `check:part-caches`, `check:size`) because of a `WeakMap` I had added in `journal.ts`. I reworked that and folded it into 61476b9956, and the rerun passed.
- `npm run lint -w @weasel-js/history`: not available, since the package has no `lint` script. Instead I ran eslint on every changed file: pass (exit 0).
- `npm run check:changesets`: pass, "OK — 1380 changeset(s)". The warnings it printed are on other changesets, not mine.
- Tree is clean.

tally: 6 of 6 fixed, 0 extra fixed