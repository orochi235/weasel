# Findings: apps.chart

No defects found. Checked: every glyph's geometry against its comment (snapShapes' two boxes both center on
px(7), the guide's row; snapGaps' two gaps are both 3 pixels and their outer strokes ink inside the 20×20
viewBox; autoLayout's bus meets each box's center column and nothing inks past px(13)); `apps/chart/src/icons.table.json`
matches what actions.mjs generates; the icon wrapper supplies `fill="none"` (as in
`packages/kernel3d/src/icons.browser.test.ts`), so the unfilled `box` paths draw as outlines; index.mjs has the
same shape as the other apps' icon indexes; vite.config.ts matches apps/draw's (ports entry `chart` exists,
distinct cacheDir, `LAN_SERVER` for the host).

## Files read
apps/chart/icons/actions.mjs
apps/chart/icons/index.mjs
apps/chart/vite.config.ts

<!-- done: 0 findings, files read: 3 -->
