LensZoom press released in place, dragged back to its start, or canceled never returned the keys (A): fixed 51195c530f (with 0c75870f8e: useLatest for the gate's no-render-ref-write rule)

Follow lens's reticle hit box sits under the pointer and takes every press (A): fixed bc4618d60c

Opening a quick lens records two undo entries (A): fixed ede3d4debc

Grid toggle says "Grid needs…" while one DPR cell still draws a grid (A): fixed 3234683f80

scrollByWheel stops at a body whose overflow went to the viewport (A): fixed 624077344e

Copied form control with a `form` attribute joins the trial's form (A): fixed b1a4ace7be

Split lens with two DPRs shows base at one DPR beside the comparison at the other (B): fixed e6d32c49e1. This was a behavior call: Split now shows one pair at the first DPR, as Difference does, rather than a seam inside each DPR cell. Recorded in `docs/unruled.md`.

Wheel pass-through mishandles an RTL horizontal scroller (B): fixed 2f96104cf3

Pixel grid assumes a capture's bitmap is `box × dpr` pixels (B): fixed ce8019b3d2. The grid now steps by the capture's own `dpr` instead of resampling to the requested one. Resampling nearest-neighbor would duplicate pixels and erase the soft-edge mask.

Seam click without dragging moves the seam and records an undo entry (B): not a defect. The pointer recognizer holds a drag's press back until a move crosses the threshold, and that move reaches `onMove` straight away (`gestures/src/recognizer/pointerRecognizer.ts` `move`). A click never starts `loupe.seam`, and every release that does reach `onEnd` already has a preview.

Extra commits, not defects: 2d69d02c2c (biome formatting) and the shortening of two changeset titles that ran past 140 characters.

Checks:
- Each test file run alone with `--maxWorkers=1`:
  - LensZoom.test.tsx: 3 passed
  - lensHitBoxes.test.ts: 6 passed
  - lensActionDefs.test.ts: 17 passed
  - GridCanvas.test.tsx: 9 passed
  - scrollByWheel.test.ts: 6 passed
  - cloneSource.test.ts: 16 passed
  - LensSlot.test.tsx: 27 passed
  - GridCanvas.captureDpr.test.tsx: 1 passed
  - compare.test.ts: 16 passed
  - LensSlot.difference.test.tsx: 1 passed
  - GridCanvas.density.test.tsx: 1 passed
  - lensApi.test.tsx: 16 passed
  - LensActions.test.tsx: 8 passed
- Not run (browser): LensZoom.browser.test.tsx, LensOverlay.browser.test.tsx, LabLoupe.browser.test.tsx, LensChrome.browser.test.tsx, useWheelPassThrough.browser.test.tsx
- `.skulkr/in/on-fleet typecheck 15 checks -- npm run checks:gate`: "checks:gate: all 33 passed"
- `npm run lint -w @weasel-js/labkit`: exit 0
- `npm run check:changesets`: "OK — 1151 changeset(s), 83 with warnings", none of the warnings from this round's changesets

tally: 9 of 10 fixed, 0 extra fixed