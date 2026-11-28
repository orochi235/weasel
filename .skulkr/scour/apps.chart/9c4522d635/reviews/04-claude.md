# apps.chart audit findings

No defects found. Checked: each glyph's geometry against its comment (shared guide at px(7) through both
`snapShapes` boxes; equal 3-pixel gaps and measures in `snapGaps`; `autoLayout` bus and stems landing on box
edges and centers), ink extents against the 20-unit viewBox at stroke 1.5, the committed
`apps/chart/src/icons.table.json` against the source (matches), and `vite.config.ts` against `apps/draw`'s
(same cache, public-dir, LAN and port handling; chart reads no `__WEASEL_REPO_ROOT__`).

## Files read
apps/chart/icons/actions.mjs
apps/chart/icons/index.mjs
apps/chart/vite.config.ts

<!-- done: 0 findings, files read: 3 -->
