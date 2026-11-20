- snapGaps' and autoLayout's outer boxes ink past the 20×20 viewBox (B): fixed 7b0f1582d3. snapGaps' outer boxes now span pixels 1–3 and 12–14. autoLayout now uses pixels 1–14, and its stem, bus and drops still meet each box at its center. I regenerated `apps/chart/src/icons.table.json`. The new test `apps/chart/src/icons.ink.test.ts` keeps every chart action glyph's ink inside 0..20. No changeset: apps/chart is not a published package.
- A reported no defects. Its checks of the glyph grid, the dashes, tick clearance and vite config still hold after the fix.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1 apps/chart/src/icons.ink.test.ts`: fail before the fix (snapGaps and autoLayout), pass after (3/3).
- `npm run checks:gate`: pass (all 32 passed, root `npm run lint` among them).
- `npm run lint -w <pkg>`: not run, since apps/chart has no package of its own. Root lint covers `apps` and passed inside the gate.
- `npm run check:changesets`: pass (inside the gate, no changeset added).