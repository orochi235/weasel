- [r57-1] Marks a shaper clusters onto a space, tab, or soft hyphen were never drawn (carried): fixed abae84e623. When a shaped cluster opens on a code point that layout measures itself (a space, a tab, a soft hyphen, a hard line break, or a color cluster), the cluster's other code points are now measured on their own too. Spaces, tabs, and hyphens keep their usual handling.
- [r57-2] A throw in `layoutRuns` while evicting a structural-list entry left that entry pointing at recycled columns (carried): fixed 535729ad1b. The entry being evicted is now made unmatchable before layout starts. `evictRunsForRefill` already did this, and both now use the same `blank` helper.
- [r57-3] A painting that threw left its groups in the slots, and the next painting took them over (carried): fixed c6a6d9f8c7. Each painting now starts by emptying the slots (`openGroups`). The test showed the next text being drawn in the earlier text's fill.
- [r57-4] `outlineMinSize: NaN` was cached as "no outlines" but painted every glyph as an outline (carried): fixed ca52c0e21e. This was a behavior call: `paintRuns` and `cachedPaintRuns` now throw a `RangeError` on `NaN`, and the renderer's `drawText` never passes a `NaN`. The call is recorded in `docs/unruled.md`; treating `NaN` as "omitted" was the alternative.

Extra:
- `layoutEntries.ts` grew past the 400-line `check:size` cap after the r57-1 fix: fixed de7fe8fe9a. `mirrorEntries` and `unshaped` moved into `mirrorEntries.ts`. This only repairs damage from my own change, so it is not counted as an extra defect.

Checks:
- `npx vitest run --maxWorkers=1` on each file, one at a time: these files I touched passed: `layoutEntries.specialClusters` (new) 3/3, `layoutRecycle` 12/12, `paintRuns.groups` 10/10, `paintCache` 16/16. These related files also passed: every `layoutEntries.*`, `softHyphen` 12/12, `tabs` 12/12, `layoutCache` 21/21, `layoutRefill` 5/5, `layoutPools` 4/4, `paintRuns.order` 1/1, `bidiIntegration` 23/23, `layoutLines.bidiOrder` 7/7, and `renderer/drawText.outline` 15/15. Each new test failed before its fix.
- `npm run checks:gate`: the first run failed 1 of 32 (`check:size`, `layoutEntries.ts` at 404 lines). After de7fe8fe9a: "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/text` and `-w @weasel-js/renderer`: neither package has a `lint` script (npm error: missing script). eslint on every changed file passed with no output, and the gate's root `npm run lint` passed.
- `npm run check:changesets`: pass (OK).

tally: 4 of 4 fixed, 0 extra fixed