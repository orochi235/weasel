LensDifference bare setTimeout on a computed delay (A): not a defect (`scripts/check-timers.ts` allowlists `LensSlot.tsx`, because `useCaptureDelay` only ever answers 0 or `LENS_REST_MS`)
GridCanvas bare setTimeout on a computed delay (A): not a defect (`GridCanvas.tsx` is on the same allowlist, for the same reason)
Live lens copy goes stale when anything outside the lab body scrolls (A): fixed 4738d24d8d
Wheel pass-through scrolls a root that is `overflow: hidden` (A): fixed 0e236ac7c4
Clone source whose `root` holds the lens copies its own copies every frame (A): fixed 256f6492a9
Click in a round lens's corners is picked as inside the lens (A): fixed 9268f95ab6
Turning `hollow` on while the lens is up invalidates nothing (A): fixed 780fe00374
createLensApi and lensClient ignore the overlay's camera (B): fixed d642ac9ebd (adds an `attachment` option to `createLensApi` and an `attachment` argument to `lensClient`; the overlay's reticle point now goes through the same helper)
Split seam hit-tested at a world-rounded x but drawn at a screen-rounded x (B): fixed 53286d4295
Two loupes in one camera share action ids, so only the newest aims (B): fixed 395d6f4fe1. This was a behavior call nobody had made, so I made the strict one: the setup stays unsupported, and the second loupe to mount now warns in development. One hover runs one action on the camera's dispatcher, so separate ids alone would not make both loupes aim. Recorded in `docs/unruled.md`.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: `lens/useLensRemeasure.test.tsx` pass (2), `lens/scrollByWheel.test.ts` pass (4), `lens/cloneSource.test.ts` pass (11), `useLoupe.test.tsx` pass (40), `useLensDamage.test.tsx` pass (3), `lens/lensApi.test.tsx` pass (16), `lens/compare.test.ts` pass (13), `LoupeGestures.test.tsx` pass (7), `lens/LensSlot.test.tsx` pass (26), `lens/LensActions.test.tsx` pass (8), `lens/lensHitBoxes.test.ts` pass (5)
- `npm run checks:gate`: "checks:gate: all 33 passed"
- `npm run lint -w @weasel-js/labkit`: pass (exit 0)
- Unrun here: the browser tests that import the changed files (`LensOverlay.browser.test.tsx`, `useWheelPassThrough.browser.test.tsx`, `LabLoupe.browser.test.tsx`, `TrialLoupe*.browser.test.tsx`)

tally: 8 of 10 fixed, 0 extra fixed