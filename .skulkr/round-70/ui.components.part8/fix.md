Ring arrows stepping across a ring boundary (A): fixed 8eab7d53bb

SpanStrip arrow key stepping from an `at` outside the window (A): fixed 75528401e8

Switch handing stale modifier keys to a keyboard toggle after a refused click (A): not a defect (Space on the native input fires a click, which passes the label's `onClickCapture` and refreshes the keys first; a probe that Alt-clicked a read-only switch, lifted the hold, then pressed Space with user-event got `{ alt: false }`)

`aria-readonly` on SwatchGrid and SwatchRings swatch buttons (B): fixed f73ce25b40. The read-only styling now keys off the palette root's `data-held`, and `describeHold` takes a `readonlyRole: false` option that checks the attribute is absent.

ShortcutSheet's `useSyncExternalStore` missing a server snapshot (B): fixed 939b786622. Its `renderToString` test threw "Missing getServerSnapshot" before the fix.

ShortcutSheet key search ignoring a shortcut's leader keys (B): fixed 796658d8b8

Checks:
- `npx vitest run --maxWorkers=1` on each touched test file: SwatchGrid.along.test.tsx pass (19), SwatchGrid.hold.test.tsx pass (11), SpanStrip.test.tsx pass (22), sheetRows.test.ts pass (3), ShortcutSheet.ssr.test.tsx pass (1), ShortcutSheet.test.tsx pass (7). Also ran SwatchGrid.test.tsx pass (17) and SwatchGrid.toggles.test.tsx pass (8). Each new test failed against the original source before its fix.
- `npm run checks:gate`: the first run failed with "checks:gate: 1 of 33 failed" (check:changesets: three titles over 140 characters). After shortening them: "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/ui`: does not exist, because the package's only scripts are `build` and `test`. Instead I ran eslint on every changed .ts/.tsx file: pass, no output.
- No browser test files touched. Tree clean.

tally: 5 of 6 fixed, 0 extra fixed