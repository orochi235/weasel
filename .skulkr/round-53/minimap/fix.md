Fit frames hidden descendants of a shown group (A): fixed 7b327edd1d

`rootView` reads a stale `mainView`, so zoom samples in one frame overwrite each other (A): fixed 2fda0beb5f (my call on the behavior, recorded in `docs/unruled.md`)

Touch pinch starting at spread 0 never zooms (A): fixed d4a1cb5c52

`layerVisibility` hides a layer but the fit still frames it (A): fixed 415eee8864 (also exports `paintedSceneLayers` from core, with its own `minor` changeset, and updates the core export inventory)

`rootView` stale until re-render, back-to-back samples don't add up (B): duplicate of A's stale-`rootView` finding

Spread-0 pinch does nothing, pan included (B): duplicate of A's spread-0 finding

`useFitView` refits on every render under a `"scene"` fit after an override publish or scroll (B): fixed bfd92d5f25

Checks:
- `npx vitest run --maxWorkers=1` on each test file touched or affected: pass for `minimapMath.test.ts` (36), `MinimapCanvas.fit.test.tsx` (4, new), `MinimapCanvas.wheel.test.tsx` (7), `MinimapCanvas.pinch.test.tsx` (9), `MinimapCanvas.test.tsx` (19), `createMinimapContribution.fit.test.ts` (1), and `minimap.test.tsx` (16).
- `npm run checks:gate`: pass, "checks:gate: all 32 passed".
- `npm run check:changesets`: pass, "OK — 2543 changeset(s)".
- `npm run lint -w packages/minimap` and `-w packages/core`: fail with `Missing script: "lint"`. Neither package has a lint script. The root `npm run lint` passed inside the gate, and `npx eslint packages/minimap/src packages/core/src/barrel/canvas.ts` passed.

Tree clean, 5 commits on top of the frozen commit.

tally: 5 of 7 fixed, 0 extra fixed