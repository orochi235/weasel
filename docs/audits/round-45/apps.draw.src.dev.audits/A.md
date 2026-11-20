# Findings: apps.draw.src.dev.audits

Note: this tree's HEAD is 782733b19c, not 04c3a65 (that object is not in the repo), and `apps/draw/src/dev/audits/` is untracked here. The files were read as they are in the working tree.

## A pending round's "found" bar draws nothing: the classes it uses (`pending`, `hatch`, `tag`) are not in RoundsChart.module.css
- where: apps/draw/src/dev/audits/RoundsChart.tsx:35,47-51 (RoundsChart)
- scenario: `map.rounds` holds a round with `pending: 'live'` or `'unmerged'`. The bar gets `className={s.pending}` and `fill="url(#hatch)"`, and the pattern's `<line className={s.hatch}>` draws the hatch. RoundsChart.module.css defines only `chart`, `grid`, `axis`, `est`, `found` and `hint`, so `s.pending`, `s.hatch` and `s.tag` are all undefined. The pattern's line has no stroke (SVG's default is `stroke: none`), so the pattern is transparent and the round's distinct-found bar is invisible. Only the dashed estimate outline shows, and the "live"/"unmerged" tag falls back to SVG's default unstyled text. It should be a visible hatched bar, as the chart's own hint says ("Hatched: a round not merged yet, or still running").
- evidence: read (grep for `.pending|.tag|.hatch` in the area's CSS finds only `palette.module.css`'s `.hatch` probe, which is a different module)
- severity: medium

## A dev server without the skulk plugin shows "Couldn't read the audit map: Unexpected token '<'…" instead of the no-server note
- where: apps/draw/src/dev/audits/useSkulkMap.ts:39-41 (useSkulkMap, ask)
- scenario: The `no-server` state is documented as covering "a server without the plugin". Only a 404 maps to it. Vite's dev server has an HTML fallback for extensionless GETs whose `Accept` includes `*/*`, which is what `fetch` sends. So any Vite server lacking `skulkMapPlugin` (an older draw server still running, or another app's server showing this route) answers `__skulk/map` with `200` and `index.html`. `res.json()` then throws a SyntaxError, and the page shows `failed` with a JSON parse message rather than the "start it with `emilia up dev:draw`" note. It should recognize a non-JSON (`text/html`) answer as no-server.
- evidence: read
- severity: low

## A 404 after a good map throws the map away, despite "a failed ask keeps the last map it had"
- where: apps/draw/src/dev/audits/useSkulkMap.ts:39 (useSkulkMap, ask)
- scenario: The page is `ready`, and then the dev server restarts or the route briefly 404s during a plugin reload. `setState({ status: 'no-server' })` replaces the ready state, so the whole chart unmounts. That resets the treemap scene, the selection and the hover, and swaps in the "start the dev server" note until the next poll 15 s later. Every other failure keeps `map` and sets `error`, which is what the hook's doc promises.
- evidence: read
- severity: low

## Returning to the tab does not ask "at once" unless a poll came due while it was hidden
- where: apps/draw/src/dev/audits/useSkulkMap.ts:49-64 (useSkulkMap, loop/onVisible)
- scenario: `held` is set only when the pending `after(everyMs, loop)` fires while `document.hidden`. If the tab is hidden and shown again inside the 15 s window, `onVisible` sees `held === false` and does nothing, so the page waits out the rest of the timer. The doc says it asks again "at once when it becomes visible again". The same happens for any hide shorter than `everyMs` after the last ask.
- evidence: read
- severity: low

## A cell whose own id and parent are unchanged still loses its node, and so its selection, when an ancestor frame is re-parented
- where: apps/draw/src/dev/audits/auditScene.ts:160-176 (syncAuditScene)
- scenario: `gone` holds only nodes whose own wanted parent differs. Say a new area appears and a frame gains a new frame between it and its old parent (areaTree collapses one-child frames, so `core.canvas` can move from `package:core` to `package:core.canvas`'s new parent). That frame is removed, and `removeMany` takes its whole subtree, including cells whose spec parent is still that frame's id. Those cells are then re-added as new nodes. A picked area under that frame loses its selection on the refresh, while the function's doc promises that "a node whose id and parent stay keeps its identity, so the selection on it survives a refresh". It should `move` the re-parented frame, or exclude kept descendants from the removal.
- evidence: read
- severity: low

## An unfinished review, or one that hit its token ceiling, is not marked bad in the jobs feed
- where: apps/draw/src/dev/audits/runData.ts:67-71 (parseJob)
- scenario: `area.mjs` appends `, hit its ceiling` and `, unfinished: not counted as a pass` to a review's progress line. The regex ignores that tail, and `bad` is only `read !== files`. A review that read every file but never finished (so it is not counted as a pass) shows as a normal blue "review" row, with nothing to say it went wrong. `Job.bad` is documented as "whether it went wrong". It should be true when the line carries `unfinished` (and arguably `hit its ceiling`).
- evidence: read (scripts/skulk/area.mjs:77 for the line format)
- severity: low

## The heat ramp's comment says the hot end is "6 or more"; the scale puts it at the 98th percentile, at least 8
- where: apps/draw/src/dev/audits/palette.module.css:13-14
- scenario: Someone reading the palette to interpret the map takes the brightest cells to mean ≥6 defects left. `heatScaleOf` (areaData.ts:59-62) maps `left` through log1p onto `max(8, p98)`. So a cell with 6 left sits at about 0.89 of the ramp, not at its end, and the top moves with the data.
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

<!-- done: 7 findings, files read: 32 -->
