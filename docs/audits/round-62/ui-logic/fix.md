- [r56-4] carried: `envNumber` read a keyword font weight as the fallback. Fixed in 26be38a693. The new `envFontWeight` reads `normal` as 400 and `bold` as 700. It falls back on `bolder`, `lighter`, and any weight outside 1–1000. `buttonMetrics` and `menuPanelMetrics` now use it, and it has its own changeset.
- [r57-5] carried: `envNumber` read a percentage or a keyword as a bare number. Not a defect (no longer applies): `envNumber` now only accepts a unitless CSS number, so a percentage or a keyword falls back, and `measure.test.ts` already covers this.

Extra defects: none.

Checks:
- `npx vitest run --maxWorkers=1 packages/ui-logic/src/measure.test.ts`: pass (7 passed)
- `npx vitest run --maxWorkers=1 packages/ui-logic/src/button.test.ts`: pass (8 passed). The new test was run against the old `button.ts` and `menuPanel.ts` and failed there.
- `npx vitest run --maxWorkers=1 packages/ui-logic/src/menuPanel.test.ts`: pass (7 passed)
- `npm run check:changesets`: pass ("OK — 3210 changeset(s)")
- `npm run checks:gate`: first run failed 3 of 32 on an unused `envNumber` import in `button.ts`. After fixing it: pass ("checks:gate: all 32 passed")
- `npm run lint -w @weasel-js/ui-logic`: not run, because the package has no `lint` script. The gate's `npm run lint` covers it and passed.

tally: 1 of 2 fixed, 0 extra fixed