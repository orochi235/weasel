- gantt month/year duration from a month's end overflows into the next month (A+B): fixed 6444692b3c. The drag read-back now counts calendar months too. The existing test that pinned the overflow (`2026-01-31` + `1M` → `03-03`) now expects `02-28`, which is what Day.js gives.
- gantt branch or id rename leaves later references on the old name (A+B, branch half): fixed fdc4918fda. It now refuses a name another branch holds, including the main branch.
- gitgraph commit id change leaves cherry-picks naming the old id (A+B): fixed 9ab82030ea. This covers a cherry-pick's `parent` too, and dropping an id renames to the id the commit is given automatically. It now refuses an id another commit holds.
- `setGitCommandKind` fills a merge or cherry-pick with a branch or commit it can't use (A+B): fixed a85687a494. The fill now comes from the history before `at`. The existing test that expected a converted commit to pick its own vanished id now expects `''`.
- `moveGanttTaskToSection` within one section reads `at` after removal, and throws at the section's length (A+B): fixed 99475f24b1.
- gantt drag past year 9999 or before 0 writes a date its format can't read (A): fixed 75bc548265. `formatGanttDate` now keeps dates within the years the format reads back. The same defect sat in `YY` (1969–2068) and in formats with no year (1970), and both are fixed. Recorded in `docs/unruled.md`.
- long forward `after` chain overflows the stack (A): fixed a24c6508a5. The test hit `RangeError` before the fix. Dependencies are now resolved on an explicit stack in the same order, so cycles resolve as before.
- `ganttDurationBetween` counts excluded days past `WALK_LIMIT`, so a long task shrinks on edit (B): fixed 24180ed7f4.
- `todayMarker` `rgb()`/`hsl()` stroke is cut at its first comma (B): fixed 42c9b3fb3a.
- PlotView undo after a resize or theme change restores marks for the old size and theme (B): fixed ba3ddc9cae. The prop sync moved into `plotViewSync.ts`, and an undo or redo that brings back a chart drawn for older props redraws it, without adding a history entry. The test covers both undo and redo.
- duplicates: A's branch rename = B's branch rename; A's commit id = B's commit id; A's merge fill = B's kind defaults; A's `moveGanttTaskToSection` = B's; A's `addMonths` = B's.

Extra: the `YY` and year-less date ranges above, fixed in the same commit. My strict calls (refusing a taken branch name or commit id, and keeping dates within the years the format reads) are recorded in `docs/unruled.md` in 02d6a274a2.

Checks:
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed typecheck, lint and typecheck:packages on my code (`findLast`, a test type, hook deps); I fixed those and reran.
- `npm run lint -w @weasel-js/plot`: fail, "Missing script: "lint"". plot has no lint script, so I ran `npx eslint packages/plot/src` instead: exit 0.
- `npm run check:size`: "sizes: no file or function grew past its cap."
- `npm run check:changesets`: "[changesets] OK — 2547 changeset(s)."
- Each touched test file run alone with `--maxWorkers=1`, all pass: gantt/schedule.test.ts 5, gantt/gantt.test.ts 20, gantt/structure.test.ts 9, gitgraph/structure.test.ts 7, plotViewSync.test.tsx 2, PlotView.test.tsx 2, gantt/gantt.pbt.test.ts 5, gantt/structure.pbt.test.ts 1, gitgraph/replay.pbt.test.ts 4, gitgraph/gitgraph.test.ts 12.
- Unrun: PlotView.drag.browser.test.tsx (browser test; I didn't touch it, but it uses PlotView).

The tree is clean.

tally: 15 of 15 fixed, 1 extra fixed