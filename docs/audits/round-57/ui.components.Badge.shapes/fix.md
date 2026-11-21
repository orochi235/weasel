- quatrefoil `samples` had no bound, so Infinity hung the page and NaN threw (A): fixed 33e1467d2c
- beavis `points` skipped `repeatCount`, so Infinity or NaN drew NaN spikes (A): fixed d7c3726b80
- receipt `tearDepth` had no upper bound, so the two tears crossed (A): fixed 4ea1055104
- house `peakHeight` had no upper bound, so the roof rose out of the box (A): fixed e43bec6b0f
- composed shapes' declared `insets` were never read, so house, coffin, hexagon and others took the base's padding (B): fixed 607b42e8ff (ribbon now reads its base's taper insets; square declares the 0/4/0/4 it already drew with)
- NaN in a clamped continuous param reached the drawn path (B): fixed c26d326459 (also perforated `holeRadius`, starburst `erosion`, and the coffin, house, hexagon, notched and shield clamps)
- `SHAPES` is a plain object, so `"constructor"` resolved through Object.prototype (B): fixed 42beb9cd6d (`BASES` and `EFFECTS` had the same lookup and got the same null-prototype table)
- beavis `cornerRadius` scaled with the badge's height instead of staying in px (B): fixed 0c6e3256da (adds a px `radius` to the `rounded-rect` base, with a `minor` `api` changeset)
- receipt `tearDepth` had no upper bound (B): duplicate of A's receipt finding, fixed 4ea1055104

These were behavior calls nobody had made, so I made them and recorded them in `docs/unruled.md` (fda09d5743):
- the chosen bounds: samples 24..1024, beavis points 3..256, tearDepth ≤ 45, peak ≤ eaveY
- NaN reads as the param's default
- composed shapes pad by their own insets, so beavis, cloud, plaque, postage and scalloped now pad more widely

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: `bases/Quatrefoil.test.ts` pass (7), `shapes/params.test.tsx` pass (54), `shapes/index.test.tsx` pass (15), `Badge.test.tsx` pass (43), `bases/rectBases.test.ts` pass (4). The whole Badge and Powerline directories also pass (27 files, 499 tests).
- Each new test failed before its fix: confirmed by reverting the fix for the NaN, receipt, registry and insets tests. For the quatrefoil, beavis, house and radius tests I'm inferring it from the code rather than a run.
- `Badge.browser.test.tsx` was not touched and not run here. Its fitted-base inset test uses the `base` prop, whose path this change leaves alone.
- `npm run check:changesets`: pass.
- `npm run checks:gate`: all 32 passed.
- `npm run lint -w @weasel-js/ui`: not run. That package has no `lint` script (npm: missing script); the root `lint` inside the gate passed.

tally: 9 of 9 fixed, 0 extra fixed