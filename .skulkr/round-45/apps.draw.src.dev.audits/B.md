## RoundsChart uses `.pending`, `.hatch` and `.tag` classes its stylesheet never defines, so pending rounds draw as empty bars
- where: apps/draw/src/dev/audits/RoundsChart.tsx:35,47,51 (RoundsChart); apps/draw/src/dev/audits/RoundsChart.module.css
- scenario: a round with `pending: 'live'` or `'unmerged'` gets the class `s.pending` (undefined) and `fill="url(#hatch)"`. The pattern's `<line className={s.hatch}>` has no class and no `stroke` attribute, so the pattern paints nothing, and the bar for the found defects can't be seen. The `live`/`unmerged` tag text (`s.tag`, also undefined) falls back to the SVG default: black fill at the inherited font size, not the 9px muted axis style. The hint says "Hatched: a round not merged yet, or still running", but no hatch ever appears.
- evidence: read (RoundsChart.module.css defines only `.chart .grid .axis .est .found .hint`)
- severity: medium

## parseJob drops the `patch <id>: did not apply: …` line, so a failed patch never shows in the jobs feed
- where: apps/draw/src/dev/audits/runData.ts:82 (parseJob)
- scenario: `scripts/skulk/land.mjs:29,48` print `patch <id>: did not apply: <error>` when an area's patch fails. The patch regex needs `: (\d+) commits on`, and no later branch matches `patch`, so `parseJob` returns null and `recentJobsOf` filters the line out. The feed lists the successful patches and silently omits the failed one, which is exactly the case `Job.bad` exists to flag ("a conflict"). It should be a `patch` job with `bad: true`.
- evidence: read
- severity: medium

## Identical log lines give duplicate React keys in the jobs feed (`fleet: test:batch passed` once per catch-up pass)
- where: apps/draw/src/dev/audits/runData.ts:107 (recentJobsOf); apps/draw/src/dev/audits/JobsFeed.tsx:38
- scenario: `land.mjs:74` prints `fleet: test:batch passed` on every pass of its catch-up loop, with the same text each time. `recentJobsOf` keys each row `${round}:${line}`, so two passes give two rows with one key. React warns and reconciles the two rows as one. `JobsFeed`'s `fresh` set is keyed the same way, so the second pass's row never flashes as new. Keys should include the line's index.
- evidence: read
- severity: low

## The shared lane reads "waiting … once every lane is patched" while the run waits on the merge lock
- where: apps/draw/src/dev/audits/runData.ts:26 (sharedLaneOf)
- scenario: the run's steps are `freeze`, `review`, `patch`, `batch`, `merge-wait` and `fleet` (night.mjs:281–290, land.mjs:97,102); no step is called `merge`. While `step === 'merge-wait'`, every lane is already patched and the batch is built, but `sharedLaneOf` matches only `batch|merge|fleet`, so it falls through and shows the waiting state with text saying the lanes aren't all patched yet. The `'merge'` it tests for never occurs.
- evidence: read
- severity: low

## The run's start-up "control sweep: …" announcement is listed as a finished sweep job
- where: apps/draw/src/dev/audits/runData.ts:88 (parseJob)
- scenario: night.mjs:130 prints `control sweep: off (it runs only with --sweep)` or `control sweep: one browser job at the frozen commit beside the reviews, …` at start-up, before any job runs. `parseJob` turns any line starting `control sweep:` into a `sweep` job, so every round's feed shows a "sweep" row with the result "off (it runs only with --sweep)", or with the plan text, as if a sweep job had come back. `JobsFeed` is documented as listing the jobs a run's log reports finished.
- evidence: read
- severity: low

## A review marked "unfinished: not counted as a pass" is not flagged bad
- where: apps/draw/src/dev/audits/runData.ts:70 (parseJob)
- scenario: area.mjs:77 appends `, unfinished: not counted as a pass` (or `, hit its ceiling`) to a review line. `bad` is only `m[7] !== m[8]` (files read vs files), so an unfinished review that read every file shows in the feed as a normal info-graded review, even though its result was thrown away. `Job.bad` is documented as "whether it went wrong".
- evidence: read
- severity: low

## A failed part's span ignores its recorded start/end times and is drawn at its typical length
- where: apps/draw/src/dev/audits/phases.ts:96-103 (timesOf), :152 (laneViewOf)
- scenario: `timesOf` returns an `end` only for a running or done part. A failed step that carries `started`/`ended` gets `end = null`, so `laneViewOf` draws it `TYPICAL_MINUTES` long from its start: a fix that failed after 40 minutes shows as an 18-minute span. `LaneView.ended` takes that made-up end as well.
- evidence: read
- severity: low

## A 404 on a later poll throws away the map already shown
- where: apps/draw/src/dev/audits/useSkulkMap.ts:39 (useSkulkMap ask)
- scenario: with the state `ready`, one poll that gets a 404 (for example, the dev server restarting without the plugin route registered yet) calls `setState({ status: 'no-server' })`. The page replaces the chart with the "start the dev server" note, which contradicts the hook's doc: "A failed ask keeps the last map it had and says why". Every other failure keeps `was.map`.
- evidence: read
- severity: low

## Files read
apps/draw/src/dev/audits/AreaDetail.module.css
apps/draw/src/dev/audits/AreaDetail.tsx
apps/draw/src/dev/audits/AuditsPage.module.css
apps/draw/src/dev/audits/AuditsPage.tsx
apps/draw/src/dev/audits/HeatLegend.module.css
apps/draw/src/dev/audits/HeatLegend.tsx
apps/draw/src/dev/audits/JobsFeed.module.css
apps/draw/src/dev/audits/JobsFeed.tsx
apps/draw/src/dev/audits/LiveRuns.module.css
apps/draw/src/dev/audits/LiveRuns.tsx
apps/draw/src/dev/audits/NextUp.module.css
apps/draw/src/dev/audits/NextUp.tsx
apps/draw/src/dev/audits/RoundsChart.module.css
apps/draw/src/dev/audits/RoundsChart.tsx
apps/draw/src/dev/audits/Stats.module.css
apps/draw/src/dev/audits/Stats.tsx
apps/draw/src/dev/audits/Treemap.module.css
apps/draw/src/dev/audits/Treemap.tsx
apps/draw/src/dev/audits/areaData.ts
apps/draw/src/dev/audits/areaTree.ts
apps/draw/src/dev/audits/auditPainter.ts
apps/draw/src/dev/audits/auditScene.ts
apps/draw/src/dev/audits/clock.ts
apps/draw/src/dev/audits/heat.ts
apps/draw/src/dev/audits/mapLayout.ts
apps/draw/src/dev/audits/palette.module.css
apps/draw/src/dev/audits/phases.ts
apps/draw/src/dev/audits/runData.ts
apps/draw/src/dev/audits/skulkMap.types.ts
apps/draw/src/dev/audits/skulkMapRoute.ts
apps/draw/src/dev/audits/useAuditPalette.tsx
apps/draw/src/dev/audits/useSkulkMap.ts

<!-- done: 8 findings, files read: 32 -->
