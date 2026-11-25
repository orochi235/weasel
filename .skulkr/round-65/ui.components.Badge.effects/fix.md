[A0] Sunbeams fade mask stops at the 0..100 box (A; B also reports it): fixed bb29911eac
[A1] Sheen and the aqua/metal gloss paint a fixed 0..100 rect (A; B also reports it): fixed bb29911eac
[A2] Sunbeams `gradientAngle` measured in the stretched viewBox, not on screen (A+B): fixed 2eb0456e1f
[A3] Woodgrain knots flatten on a wide badge (A): fixed e0f30ced06
[A4] A negative spike `length` throws spikes outward on tight corners only (A): fixed b1cc448a95
[A5] Perforations ignores `phase` (A): fixed a0b7cd2ebb
[A6] Rivets float outside a non-rectangular outline (A): fixed cc6de939ca. Each rivet is now set in from where the diagonal from its box corner meets the outline, and rivets are clipped to the body.
[B0] An infinite sunbeams `count` or woodgrain `lines`/`knots` hangs the render; a fractional one draws one too many (B): fixed f38b37c11a
[B1] `NaN` in a bump effect's params turns the outline into NaN path data (B): fixed cc0e049bec. My call, recorded in `docs/unruled.md`: a `NaN` or infinite param reads as its default, and a repeat count stops at 256.
[B2] Perforation holes get painted over by foreground effects (B): fixed 16243f3062
[B3] Sunbeams `gradientAngle` in viewBox units (B): duplicate of A2
[B4] Sheen, sunbeams, and gloss stop at the viewBox (B): duplicate of A0 and A1
[B5] Sheen's `lightFrom` lookup reaches the object prototype (B): fixed fef67aacf5. My call, recorded in `docs/unruled.md`: `sheen`, `bevel`, and `rivets` throw a `RangeError` for a `lightFrom` that is not a corner.
[r56-1] Stroke widths scaled twice (carried): not a defect (no longer applies; the stroke width is passed as given with non-scaling-stroke)
[r56-2] Gloss ends at glossExtent²/100 (carried): not a defect (no longer applies; the gradient spans its own rect)
[r56-3] Perforations hangs at radius 0 and spacing 0 (carried): not a defect (no longer applies; holes sit at least 1 CSS px apart since round 62)
[r56-4] Bevel leaves gaps at its band seams (carried): not a defect (no longer applies; `bevelBands` overlaps each neighbor by one sample)
[r56-5] Bites and scallops cut off at the midpoint between bumps (carried): not a defect (no longer applies; `bumpRadius` caps at half a step)
[r56-6] Spikes `irregularity` unclamped (carried): not a defect (no longer applies; it is clamped to 0..1)
[r56-7] Sunbeams gradient axis doesn't reach the corners (carried): not a defect (no longer applies; the span reaches the farthest corners, and now covers the outline's region)
[r56-8] Bevel insets along the viewBox normal (carried): not a defect (no longer applies; the CSS normal is scaled by `sx`/`sy`)
[r56-9] Outline effect stroke scaled twice (carried): not a defect (no longer applies)
[r56-10] Aqua/metal bezel and rim scaled twice (carried): not a defect (no longer applies)
[r56-13] Spikes `irregularity` unclamped (carried): not a defect (no longer applies)

Extra, in the B1 commit: `spikes`' `cornerCompensation` and `puffs`' `irregularity` also read `NaN` as their default.

These changes move pixels in existing badges:
- Aqua and metal body gradients now run over viewBox y 0..100, the units their documented `equator` uses, instead of the outline's bounding box.
- Rivets on a rounded-rect sit about 1 px further in at each corner, so `plaque` shifts slightly too.

Checks:
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Badge/effects/effectGeometry.test.tsx`: pass (31)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Badge/Badge.test.tsx`: pass (47)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Badge/effects/bumps.test.ts`: pass (8)
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run check:changesets`: pass ("OK — 3599 changeset(s)")
- `npm run lint -w @weasel-js/ui`: not run, because `@weasel-js/ui` has no `lint` script. Ran `npx eslint` on every changed file instead: pass.

tally: 11 of 24 fixed, 0 extra fixed