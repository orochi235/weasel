Paint drew regions whose `chromeId` was hidden (A+B): fixed 83077fc520. Paint and hit-test now share one `regionShown` check.

Annulus paint centered the inner cutout on (cx, cy) while the hit-test used innerX/innerY (A+B): fixed 5bdef1680a. The paint and the `minBandPx` floor now use the rect's real edges.

Regions were ranked by world distance under non-uniform zoom (B): fixed ef4ae6c47f. The ranking now uses screen distance, the same space the hit squares are tested in.

Escape-returns-to-default skipped the mode gate (A): fixed b839ec46cd. Tool keys and Escape now share one eligibility check.

`useKeyState({ target })` never attached to an element that mounted late or was swapped (A): fixed 78d4d74c1d. A shared core-internal `useElementEffect` re-reads the ref after every render.

Middle-drag pan didn't work with a modifier held (B): fixed c2a67b262d, with `mods: ANY_MODS`. The other half, "barred over exclusive chrome", is not a defect: `claimGestureOf` in `packages/routing/src/interactions/dispatcher/matcher.ts:94` makes an exclusive claim cover only the primary press ("a middle drag pans over a handle"). I added a test that holds this; it passes with and without `THROUGH_CHROME`, so `target` was left unset.

Extra defects found while fixing:

Annulus corners went unpainted (no reviewer): fixed 5bdef1680a. The four caps were traced in opposite directions, so where a rect corner fell inside the ellipse (a large `minBandPx`), two overlapping caps cancelled under nonzero fill. The corner could be hit but was not painted. All caps are now traced the same way.

`usePublishPointer` read its ref once, the same mistake as `useKeyState` (no reviewer): fixed 78d4d74c1d, with its own changeset and test. The test fails on the old code.

`tool.offhand` (held-key engagement) may skip the mode gate as Escape did (no reviewer): question, unverified. `packages/routing/src/interactions/actions/toolOffhand.ts:73` pushes the tool id with no `eligibleForMode` check. It is in `routing`, outside this area, so I left it alone.

Checks, each run here:
- `composeAffordanceLayer.parity.test.ts` (new): pass, 4/4
- `composeAffordanceLayer.test.ts`: pass, 22/22
- `hitAffordanceRegions.test.ts`: pass, 22/22
- `useKeybindings.test.ts`: pass, 22/22
- `useKeyState.test.tsx`: pass, 3/3
- `useKeyModifiers.test.tsx`: pass, 2/2
- `usePublishPointer.test.tsx`: pass, 7/7
- `createDragPanContribution.test.tsx`: pass, 9/9
- `packages/editing/src/chrome/affordances/rotationHandle.test.ts` (consumer of the annulus): pass, 18/18
- `npm run typecheck:packages -- core`: `1/1 core ok`
- eslint on the 13 changed files: exit 0
- `npm run check:size`: `sizes: no file or function grew past its cap.`
- `npm run check:changesets`: `[changesets] OK — 1727 changeset(s).`

The tree is clean and `.skulk/` is untouched.