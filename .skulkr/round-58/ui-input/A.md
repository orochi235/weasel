## framesSweep's default `'first'` pass walks a whole pass of a run shorter than one (loop below 1)
- where: packages/ui-input/src/sweep.ts:139-144 (framesSweep)
- scenario: `framesSweep({ duration: 100, loop: 0.5 }, { every: 10 })`. The clock plays a fractional loop to `loop * duration` (clock.test.ts: "counts a fractional loop in whole passes, ending partway through the last"), so this run lasts 50 ms. Here `walked` is 1 for `'first'` whatever `passes` is, so `end` is 100 and `ends` is false (1 !== 0.5): the walk yields 0..90, frames past the run's end that the clock never shows, and never the run's real last frame at 50. `loop: 0` (accepted: "loops 0 times or more") likewise walks a full 100 ms pass of a zero-length run. `walked` should be `Math.min(1, passes)` for `'first'`, which makes `end` 50 and `ends` true.
- evidence: read
- severity: medium

## rangeSweep with a step treats finite ends whose difference overflows as an endless range
- where: packages/ui-input/src/sweep.ts:61-75 (rangeSweep)
- scenario: `rangeSweep({ from: -1e308, to: 1e308, step: 1e306 })`. `span = to - from` is `Infinity`, so `last` is `Infinity`: `walk()` never stops at `to` (it yields values past 1e308 up to Infinity, only a cap ends it), and `at(u)` throws "an endless range has no point a fraction of the way along" for a range whose ends are both finite. With `count` the same input throws "a range given a count needs a finite end". Finiteness should be read from `to`, not from `span` (geom's `lerp` already guards this overflow, and `along` could use it).
- evidence: read
- severity: low

## movedIndex answers a different index than moveItems uses for a gap past the end or an index outside the list
- where: packages/ui-input/src/reorder.ts:22-24 (movedIndex)
- scenario: items `[a, b, c]`, `at = [0]`, `to = 10`. `moveItems` clamps the gap to 3 and puts `a` at index 2; `movedIndex([0], 10)` returns 9. Likewise `at = [-1, 0]`, `to = 2`: `moveItems` ignores -1 and puts `a` at 1, but `movedIndex` counts -1 and returns 0. Its doc says it is "the index the first of the items holds once moveItems has put them in gap `to`", and callers (`ListEditor/listEntries.ts:50`, `PageTabs/usePageTabs.tsx:79`, `TokenField/tokenDrag.ts:28`) feed it the same `at`/`to` they give `moveItems`, so focus or `onMove` lands on the wrong index; it takes no length, so it cannot clamp as `moveItems` does.
- evidence: read
- severity: low

## soloFrom and soloSweepFrom ignore `enabled` in a single selection
- where: packages/ui-input/src/selection.ts:231 (soloFrom), :249 (soloSweepFrom)
- scenario: a single-mode model, `enabled = (i) => i !== 2`. `soloFrom(model, 2, n, enabled)` returns `model.press(2)` and chooses the refused item, whereas the multiple path returns early on `!enabled(index)`. `soloSweepFrom(model, 0, n, enabled)` returns `sweepFrom(model, 0)`, whose `reach(2)` sets item 2 on, against its doc ("An item `enabled` refuses is neither reached nor changed"). The ui callers guard first (SegmentedBar's `press`, segmentSweep's `keyOf`), but a consumer going by the exported functions' docs gets the refused item chosen.
- evidence: read
- severity: low

## Files read
packages/ui-input/src/createLiveSelectionModel.ts
packages/ui-input/src/edgeScroll.ts
packages/ui-input/src/grid.ts
packages/ui-input/src/heldAt.ts
packages/ui-input/src/index.ts
packages/ui-input/src/keySteps.ts
packages/ui-input/src/list.ts
packages/ui-input/src/pbt.fixture.ts
packages/ui-input/src/press.ts
packages/ui-input/src/reorder.ts
packages/ui-input/src/scheduler.ts
packages/ui-input/src/selection.ts
packages/ui-input/src/slider.ts
packages/ui-input/src/solo.ts
packages/ui-input/src/span.ts
packages/ui-input/src/spatial.ts
packages/ui-input/src/stepRepeat.ts
packages/ui-input/src/sweep.ts
packages/ui-input/src/tabOrder.ts
packages/ui-input/src/textCommit.ts
packages/ui-input/src/tree.ts
packages/ui-input/src/typeahead.ts
packages/ui-input/src/wheel.ts

<!-- done: 4 findings, files read: 23 -->
