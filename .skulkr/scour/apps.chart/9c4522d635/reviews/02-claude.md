# Findings: apps.chart

No defects found. Checked: `px` grid (20-unit viewBox = 16px, so `H20` and pixel 1–14 bounds hold with a 1.5
stroke), each glyph's centering claims (snapShapes guide at pixel 7 centers both boxes; snapGaps gaps 3→6 and
9→12 are equal; autoLayout children centered under the bus ends), dash period 1.25 = one pixel from x=0, and the
vite config against draw/ui-lab/theme-editor configs (same plugin set, distinct cacheDir, strictPort).

## Files read
apps/chart/icons/actions.mjs
apps/chart/icons/index.mjs
apps/chart/vite.config.ts

<!-- done: 0 findings, files read: 3 -->
