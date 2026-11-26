Journal.cancel only rewinds downward, so a suspended child's edits are undone over the wrong state (A+B): fixed 0d504e3ad4

Committed journal entry's `touchedIds` leave out the base half's ids (A): fixed 112cc051f1

Restored negative ids let a later entry take the floor's id 0 (B): fixed 597c29faff. This needed a behavior call nobody had made. I made the strict one: `restore` now refuses negative ids as malformed. It's recorded in `docs/unruled.md` under the history lane, beside the round-88 ±2^52 ruling.

Checks:
- `npx vitest run --maxWorkers=1 packages/history/src/journal.cancel.test.ts`: pass (8 passed)
- `npx vitest run --maxWorkers=1 packages/history/src/history.touchedIds.test.ts`: pass (10 passed)
- `npx vitest run --maxWorkers=1 packages/history/src/history.restoreShape.test.ts`: pass (9 passed)
- `npx vitest run --maxWorkers=1 packages/history`: pass (266 passed)
- `npm run check:changesets`: pass ("OK — 1488 changeset(s), 170 with warnings"; none of the warnings are in this round's changesets)
- `npm run checks:gate`: pass ("checks:gate: all 33 passed"). The first run failed on a TS2322 in my new restoreShape test; I fixed it and amended it into 597c29faff.
- `npm run lint -w @weasel-js/history`: not run, because `@weasel-js/history` has no `lint` script (npm printed "Missing script"). The gate's lint steps passed.

tally: 3 of 3 fixed, 0 extra fixed