warp narrow domain gets no ticks (A+B; A's first finding and B's second): fixed 8b5a75f349
log domain inside one decade gets no ticks (A+B; A's second finding and B's fourth): fixed 552a36bacf
log ticks in base 2 rounded to 12 significant digits (A): fixed 92d2f33561
linear `ticks(NaN)` steps by 1 and can run to millions of ticks (A): fixed d7aa580cf9
time `ticks(NaN)` falls to the 1-second interval (A): fixed d7aa580cf9, one shared `tickCount` used by the linear, warp, log and time scales
warp/pow `format` disagrees with `tickFormat` (A+B; A's sixth finding and B's third): fixed 72acadf922
month ticks vanish in the first month a Date holds (A): fixed a7c890aaac
log `invert` sends every point to an end when the ends' logarithms round equal (A+B; A's eighth finding and B's fifth): fixed 8ba68e4e47
polar `axes: NaN` turns every point to NaN (A): fixed d594a0f863 (`Infinity` is held to 1 axis too)
time ticks hang when the domain's span overflows to Infinity (B): fixed 50c721e404
tick labels at 1e21 or more print float-noise digits (B): fixed 2815bd4184

Extra:
`warpTicks` and the log scale's ticks gave no ticks for a NaN count, and the log scale gave none for `Infinity` either (sweep): fixed in d7aa580cf9 with the NaN-count fix above, so not counted separately.
`gridOf` kept at most one digit past a value's decade, so 1.15 read "1.2" (sweep): fixed in 72acadf922 alongside the warp `format` fix, so not counted separately.

Checks:
- `npx vitest run --maxWorkers=1` on each test file I touched: `ticks.test.ts` 20 passed, `scales.test.ts` 38 passed, `polar.test.ts` 5 passed, `warp.test.ts` 10 passed.
- I also ran these, one at a time: `scales.pbt` 9 passed, `scales.shrunk` 10 passed, `mirror.pbt` 8 passed, `mirror.shrunk` 8 passed, `plot/axes.pbt` 1 passed, `ScaleDemo` 2 passed, `PropertyField.scale` 7 passed, `Slider.regions` 13 passed.
- Each new test was seen failing with its fix reverted.
- `npm run checks:gate`: all 32 passed.
- `npm run check:changesets`: OK.
- `npm run lint -w @weasel-js/scale`: not run, because the package has no `lint` script. `npm run lint` passed inside the gate.
- The tree is clean.

tally: 15 of 15 fixed, 0 extra fixed