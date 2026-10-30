# Area coverage for small atlas glyphs, 2026-10-30

The measurements behind the `docs/TODO.md` entry "Area coverage for small atlas glyphs: what is left". Taken on teitou
(Apple M5 Max, ANGLE Metal, headless Chromium), with the fill-rate runs `onto --solo`.

- `overlay-probe/*.json`: the probe from `../overlay-alignment-2026-10-29/probe/` rerun after the change,
  its `sweeps` test only. `python3 probe_summary.py overlay-probe` prints each engine's canvas centroid
  swing and `dx` per case; pointed at `../overlay-alignment-2026-10-29/overlay-probe` it prints the same
  for before.
- `fill-rate-abba/`: `tests/perf/fill-rate.spec.ts` four times in one job, before / after / after / before.
  "before" is the three shader sources (`textSdf.ts`, `batchFill.ts`, `glyphPaint.ts`) of `707858878`
  copied over the tree, so the result files' `git` block names the same tree for both sides.
- `fill-rate-variants/`: the same in a second job, with two variants of the after shader: `N`, whose
  `glyphTap` returns a constant (the branch and loop with no fetch), and `F`, whose `glyphTap` calls
  `sampleSlot` rather than a tree of its own. The `C` passes failed and wrote nothing.
- `fill-rate-flat/`: a third job, against `106f27060` as "before": before / after / flat / flat / after /
  before. `flat` is the after shader with the tap branch taken on a flat varying (`v_paintMode > 5.5`,
  never true) in place of the per-fragment field scale. `job.log` is the job's output.
- `fill-rate-split/`: a fourth job, against `106f27060`: before / after / after / before, after being the
  split that leaves the taps out of every batch build but the four a run holding small glyphs draws with.
  "before" swaps in the nine source files the split touches.
