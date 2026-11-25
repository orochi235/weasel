RoundsChart pending bar has no styles (A+B) — fixed 498c0e4d43. I also added a test (`cssModules.test.ts`) that checks every class each component in this area uses against its stylesheet. RoundsChart was the only one with missing classes.

A dev server without the plugin shows a JSON parse error instead of the no-server note (A) — fixed e5f8af9576.

A 404 after a good map throws the map away (A+B) — fixed 435b1548d0.

Showing the tab again doesn't ask at once unless a poll came due while it was hidden (A) — fixed f8cbffc4d2.

A re-parented frame takes its kept cells, and their selection, with it (A) — fixed 4213dfbd57. Re-parented nodes are now moved, and only nodes no longer wanted are removed.

An unfinished review isn't marked bad in the jobs feed (A+B) — fixed 3af5c4207c. I made the strict call: `unfinished` alone marks the row bad. `hit its ceiling` only shows in the row's text, because a review that hit its ceiling can still finish and count. This isn't recorded in `docs/unruled.md`, because `apps/draw` isn't a package and has no API.

The heat ramp comment says the hot end is "6 or more" (A) — fixed d51b4fab62. It was a comment-only change, so there is no test.

A `patch <id>: did not apply` line is dropped from the jobs feed (B) — fixed 6122d719cb.

Identical log lines give duplicate React keys (B) — fixed 8dbdb60921. The key counts copies of the same line text rather than using the line's index, because `lines` is the log's last 40 lines and indices shift every poll.

The shared lane shows "waiting" during `merge-wait` and tests for a `merge` step that never occurs (B) — fixed cf0c5bf613.

The plan's start-up `control sweep:` line is listed as a finished sweep job (B) — fixed f4a1012273. Only a `N dead…` or `did not run…` line now counts as a sweep job.

A failed part's span ignores its recorded start and end times (B) — not a defect. `map.mjs` gives `started`/`ended` only to done steps, and the only step that can fail is `patch`, which isn't an onto job and never has times. So a failed part with real times can't occur.

No extra defects were found beyond these.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `auditData.test.ts`: pass (23)
  - `cssModules.test.ts`: pass (10)
  - `useSkulkMap.test.ts`: pass (3)
  - `auditScene.test.ts`: pass (5)
  - `AuditsPage.test.tsx`: pass (4)
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run lint -w <pkg>`: not applicable, since `apps/draw` has no `package.json` and isn't a workspace package. Ran `eslint apps/draw/src/dev/audits` instead: pass (exit 0). The root `npm run lint` inside the gate: pass.
- No changesets: `apps/draw` isn't a package, so nothing a consumer installs changed. `check:changesets`: pass.
- Tree clean; nothing under `.skulk/` touched.