# Audit round 40 — apps.chart

No defects found. Checked: the generated `apps/chart/src/icons.table.json` matches what `actions.mjs` produces
(px grid, 4-place rounding); every glyph lands on pixel centers inside the 20×20 viewBox; the snapShapes guide's
1.25 dashes start at 0 and so fall on whole 1x pixels; the snapGaps measure ticks clear the box bottoms by a pixel
row at 16px; autoLayout's stem and bus meet the root and children on their centers; all three names are used
(`chartCommands.ts`, `autoLayout.ts`). `vite.config.ts` matches draw's shape (distinct cacheDir, devWatch, own-install
guard, strictPort from `dev-ports.json`, LAN server); draw's extra plugins are draw-specific or opt-in diagnostics.

## Files read
apps/chart/icons/actions.mjs
apps/chart/icons/index.mjs
apps/chart/vite.config.ts

<!-- done: 0 findings, files read: 3 -->
