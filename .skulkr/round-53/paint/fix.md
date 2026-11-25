- `paintWithColor`/`solid` multiply a non-hex color's alpha into `opacity` (A): fixed 242bfa0b29
- `parsesAsColor` fallback knows only 20 named colors (A): fixed f229ad4aab
- `strokeHasInk`/`strokeKey` report ink for a non-finite dash (A): fixed 5f0726cb92
- `lerpPaint` turns a conic angle the long way round (A): fixed eebce4312c
- `sampleResolvedStops` returns the earlier coincident stop at the shared offset (A): fixed 19fd6b6b8a. At exactly the first offset, coincident first stops also take the later one now. The property test's "past either end" check no longer samples exactly at the first offset.
- `lerpStroke` drops `vertexWidths`/`vertexColors` (A): fixed 8be0780511. This needed a behavior call. When both sides have arrays of the same length they interpolate entry by entry, and a missing width entry reads as that stroke's own width. When the lengths differ, the nearer side's array is kept. I recorded the call in `docs/unruled.md` and removed the matching Open line.
- `lerpPaint` turns a fully transparent solid black (B): fixed 2ff9381241. `mixColor` now keeps the color when both sides are clear, the way `mixStopColor` already did, and `mixStopColor` now just calls it.
- `colorLiteralToHex` returns null for `hsl` and `srgb-linear` (B): fixed 32f24c3a54. `colorLiteralToCss` now writes those spaces as hex, and its test was updated to match.
- `parsesAsColor` fallback accepts multi-value strings that start with a color function (B): fixed 14c811c3f5. The check now balances parentheses, so nested functions like `color-mix(…, rgb(…))` still pass.
- `parsesAsColor` fallback knows 20 of 148 named colors (B): duplicate of the named-color finding from A (f229ad4aab)
- conic gradient angle lerp across ±π (B): duplicate of the conic-angle finding from A (eebce4312c)

No extra defects found. One more commit, 4402324866, shortens four changeset titles that `check:changesets` rejected for running past 140 characters.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: paintDefaults.test.ts pass (6), cssColor.test.ts pass (5), paintKey.test.ts pass (18), paintKey.pbt.test.ts pass (4), lerpPaint.test.ts pass (15), lerpPaint.pbt.test.ts pass (10), gradient.test.ts pass (33), gradient.pbt.test.ts pass (10), ramp.test.ts pass (10), ramp.pbt.test.ts pass (5), palette.test.ts pass (32), palette.pbt.test.ts pass (5), paletteColorAt.test.ts pass (2), packages/theme/src/dtcg/flatten.test.ts pass (11)
- `npm run checks:gate`: the first run failed (`check:changesets`, four titles over 140 characters). After the fix: "checks:gate: all 32 passed"
- `npm run lint -w @weasel-js/paint`: `@weasel-js/paint` has no `lint` script. I ran `npx eslint packages/paint/src` instead: pass, no output.
- No browser test files were touched.

tally: 9 of 11 fixed, 0 extra fixed