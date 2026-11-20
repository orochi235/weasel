nearestStrokeEdge ignores corner-remapped vertex widths (A+B): fixed f681b2ea12

trimmed nib / metric-split-corner stroke cut at wrong place, or drew nothing (B): fixed d263685760

trim drops zero-length capped dots (A): fixed f0c3bcfba8

miter falls back to bevel at small scale (A+B): fixed b3815460fd

unknown-marker warning set grows without bound (A): fixed b60138394a

aligned rect shifted under a rotating metric although ribbonAligns says centered (B): fixed ba3c9a5d73

clipRibbon's fixed 1-unit subpath gap collapses in float32 on long paths (B): fixed 3fc811e9d6

nearestStrokeEdge corner widths (B): duplicate of A's first finding (f681b2ea12)

miter small-scale parallel test (B): duplicate of A's third finding (b3815460fd)

Extra, all in the commits above:
- **Fix is in geom, not stroke (d263685760):** `polylineAtCurve` in `@weasel-js/geom` now counts a corner split into two coincident points as one anchor. Every trim path goes through it, including `clipWindow`. The bug was worse than reported: a nibbed elbow trimmed at `start: 0.75` drew nothing.
- **Dots at either end of the path (f0c3bcfba8):** the fix also covers a dot that sits before the first measured subpath or after the last. A trim position never lands in a zero-length subpath, so such a dot is kept when the window reaches that end.
- **New shared helper (b60138394a):** I added `createWarnOnce` to `@weasel-js/registry`, with a `minor` changeset because it is new API. Stroke's marker warning and core's `warnLayersOnce`, which had its own capped copy, now both use it. This is a cleanup, not a defect, so it is not counted in X.

Checks:
- each touched test file run alone with `--maxWorkers=1`: warnOnce.test.ts pass (3), strokeEdge.test.ts pass (9), stroke.metric.test.ts pass (17), stroke.miterScale.test.ts pass (1), strokeTrim.test.ts pass (12), clipRibbon.test.ts pass (16)
- packages/stroke, packages/renderer/src/draw, packages/geom/src/tessellate, renderer trimClip and cache tests: pass
- `npm run checks:gate`: first run 1 of 32 failed (check:changesets, four titles over 140 characters); after the titles were shortened and squashed into their commits, all 32 passed
- `npm run lint -w <pkg>`: not run. stroke, geom, registry and core have no lint script. eslint on every changed file: pass. The root `npm run lint` in the gate: pass.
- `npm run typecheck:packages -- stroke geom registry core`: pass
- the tree is clean apart from `.skulk/`

tally: 7 of 9 fixed, 0 extra fixed