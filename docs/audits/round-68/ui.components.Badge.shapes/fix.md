Sparkler/starburst non-finite `outerR`/`innerR`/`rotation` give a NaN path (A+B, i.e. A0 with B0 and B1) — fixed 3b9ff7e9fd
Perforated shape lets holes overlap where the perforations effect keeps them apart (A) — fixed 69986c1eec
Perforated `holeRadius: Infinity` writes `rx="Infinity"` and the holes disappear (B) — fixed bd19220c5d (my call: the radius now stops at the box's longer side, so an infinite one draws like any radius big enough to cover the badge; recorded in `docs/unruled.md`)

No extra defects. The same unbounded `clampParam(holeRadius, 0, Infinity, …)` is in `effects/Perforations.tsx`, but that file is outside this area, so I left it alone.

Checks:
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Badge/shapes/params.test.tsx`: pass (72 passed)
- `npx vitest run --maxWorkers=1 packages/ui/src/components/Badge/shapes/Perforated.test.tsx`: pass (4 passed)
- `npm run check:changesets`: pass ("OK — 139 changeset(s).")
- `npm run checks:gate`: pass ("checks:gate: all 33 passed")
- `npm run lint -w @weasel-js/ui`: not run. `@weasel-js/ui` has no `lint` script (npm error: missing script). The root `npm run lint` inside the gate passed.
- Tree clean apart from `.skulkr/`.

tally: 5 of 5 fixed, 0 extra fixed