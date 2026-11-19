- `holdAt`/`holdPosition` hold not released by `clock.ramp(...)` (A+B): fixed 7b72218de1. It adds a new public read, `Clock.ramping`, so that changeset is `minor`.
- `holdPosition` reads an ended position as a pass past the run (A+B): fixed 2f03f84e6d
- `declare` takes the default `speed` from the current rate instead of the declared one (A+B): fixed 003db5743a
- `holdAt` and `holdPosition` give different `pending()` answers for a time past the pass end (A): fixed d3e27bc552
- A clock shadowed under its id jumps by the shadowed time when released (A): fixed 1eecbe8892. `useClockLoop` now rebases any clock that joins the loop.
- `reset()` throws on a `start: 'end'` clock whose run was made endless (A+B): fixed 24f1292909. This needed a behavior call, recorded in `docs/unruled.md` under a new "Audit round thirty-seven" section:
  - Reset now goes to the end of the declared run instead of throwing.
  - `declare` now throws a `RangeError` on a declaration with no end for such a clock, and keeps the last declaration.
- `setDuration` to or from endless keeps a stale pass end, where `applyRun` clears it (B): fixed c23ac3038a
- `holdAt.pending` compares a float round trip instead of the elapsed it sought (B): fixed 7e372568a9. The same old comparison sat in the oracles of `hold.pbt.test.ts` and `calls.pbt.test.ts`, and both now match.

Extra defects found while fixing:
- `calls.pbt.test.ts` asked for 20 "quiet" calls, more than its runs reliably reach. It failed about half the time on the unchanged frozen tree: fixed 8a4a25f4dc (floor lowered to `RUNS / 40`).
- `clock.pbt.test.ts` asked for 5 "seek:line" cases, but a random seek rarely lands on a pass line. It failed most runs on the frozen tree: fixed b3f3a054c5 (a new command now aims a seek at a pass line).

Checks (all run from the tree root, after the final rebase):
- `npx vitest run --maxWorkers=1`, one file at a time:
  - calls.pbt.test.ts: 11 passed (11); 5 more repeated runs also passed
  - clock.pbt.test.ts: 12 passed (12)
  - clock.test.ts: 56 passed (56)
  - clockMix.test.ts: 5 passed (5)
  - clockRegistry.test.ts: 8 passed (8)
  - declare.test.ts: 22 passed (22)
  - hold.pbt.test.ts: 4 passed (4)
  - hold.test.ts: 24 passed (24)
  - useClockLoop.test.tsx: 10 passed (10)
- labkit's `src/clock` tests (they use `useClockLoop`): all passed. This was before the last oracle fixup, which changed only test code. `clock.browser.test.tsx` cannot run here and was not run.
- `npm run typecheck:packages -- clock labkit`: clock ok, labkit ok
- eslint on `packages/clock/src`: ok
- `npm run check:size`: "sizes: no file or function grew past its cap."
- `npm run check:changesets`: "[changesets] OK — 1728 changeset(s)."
- Tree clean apart from `.skulk/`.