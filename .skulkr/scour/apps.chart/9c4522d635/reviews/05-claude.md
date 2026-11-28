# apps.chart findings

No defects found. Checked: every glyph's ink stays inside the 20-unit viewBox at a 1.5 stroke (`px(k) = 0.625 + 1.25k`,
pixels 0–15); the snapShapes guide's 1.25 dashes start at 0, so each one covers a whole pixel; `apps/chart/src/icons.table.json`
matches the current `ACTIONS` bodies; the vite config's cacheDir, publicDir, prebundle roots, icons plugin and port
(`dev-ports.json` `chart: 33455`) match the sibling apps (draw, theme-editor, ui-lab).

## Files read
apps/chart/icons/actions.mjs
apps/chart/icons/index.mjs
apps/chart/vite.config.ts

<!-- done: 0 findings, files read: 3 -->
