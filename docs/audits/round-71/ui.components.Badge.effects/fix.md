- Perforations infinite `holeRadius`/`holeSpacing` (A+B): fixed cccbb25125
- Aqua/Metal color-mix percentages outside 0..100 (A+B): fixed 5919ba5307. I made the strict call: it now throws a `RangeError`, following round 58's `plaque({ mix })` ruling. Recorded in `docs/unruled.md`.
- Negative rivets `radius` (A): fixed b50128b80a
- Sunbeams angle jitter crossing 90° (A): fixed bc4f9ff77e. I made the call: each beam, jitter included, is held to ±89°. Recorded in `docs/unruled.md`.
- Bevel bands overlap by one sample at seams (B): fixed a3800365fa. A band now reaches forward only, a lone band closes its ring, and bevel2 merges neighbors that share a shade.
- Woodgrain knots at fixed viewBox coordinates (B): fixed 39cfe1d89a
- `irregularity`/`cornerCompensation: Infinity` read as 1, not the default (B): fixed 0010c17910
- Non-finite `range` entry removes the effect (B): fixed 1881f26ad6
- Perforations `holeRadius: Infinity` (B): duplicate of the A+B perforations finding
- Aqua/Metal color-mix (B): duplicate of the A+B color-mix finding
- [r56-1] Stroke widths scaled twice under non-scaling-stroke (carried): not a defect (no longer applies; widths now go through raw)
- [r56-2] Gloss ends at glossExtent²/100 (carried): not a defect (no longer applies; the userSpaceOnUse gradient ends at `glossExtent`)
- [r56-3] Perforations hangs at radius and spacing 0 (carried): not a defect (no longer applies; `MIN_HOLE_PITCH`)
- [r56-4] Bevel gap at band seams (carried): not a defect (no longer applies; bands are shared through `bevelBands`, and the overlap left behind is fixed in a3800365fa)
- [r56-5] Bites/Scallops bump cut off at the midpoint (carried): not a defect (no longer applies; `bumpRadius` caps at half a step)
- [r56-6] Spikes `irregularity` unclamped (carried): not a defect (no longer applies; clamped to 0..1)
- [r56-7] Sunbeams gradient axis fixed at 100 units (carried): not a defect (no longer applies; it spans the region's corners)
- [r56-8] Bevel inset along the viewBox normal (carried): not a defect (no longer applies; the normal is a CSS unit vector, scaled by sx/sy)
- [r56-9] Outline stroke scaled twice (carried): not a defect (no longer applies)
- [r56-10] Aqua/Metal bezel and rim scaled twice (carried): not a defect (no longer applies)
- [r56-13] Spikes `irregularity` above 2 inverts spikes (carried): not a defect (no longer applies; clamped)

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1`, each file alone: effectBounds.test.tsx (new) pass 19, effectGeometry.test.tsx pass 35, effectParams.test.tsx pass 14, bumps.test.ts pass 8, effectColors.test.tsx pass 2, Badge.test.tsx pass 47
- `npm run checks:gate`: first run failed 1 of 33 (`check:changesets`: two titles over 140 characters). I shortened both titles and folded them into their commits; `npm run check:changesets` now passes (458 changesets). I did not rerun the full gate after that.
- `npm run lint -w @weasel-js/ui`: fail. The package has no `lint` script ("Missing script"); the root `npm run lint` passed inside the gate.

tally: 8 of 21 fixed, 0 extra fixed