interpolateView ignores the anchor when both scales are negative (A+B): fixed 851ca25e08

fitZoom, fitSize and useFitOnce skip the kit-wide zoom clamp (A+B): fixed af4c21cd2a. This is my call, recorded in `docs/unruled.md` under the new "Audit round forty-one" section. Tests that check the raw ratio now pass `{ min: 0, max: Infinity }`.

sceneNodeClientRect loses precision far from the origin (A): fixed 7adb513ebb

useNodeOverlayFrame's view matrix loses precision far from the origin (A): fixed 11f1abd544

useNodeOverlayFrame's toScreen and toLocal disagree once the node is gone (A): fixed 09c21e28bd. toScreen now also keeps the last invertible mapping while a live view flattens an axis, not only when the node is gone.

useDecayLoop coasts forever on friction ≥ 1 or minSpeed ≤ 0 (B): fixed 366f392adb. This is my call, recorded in `docs/unruled.md`: it throws a RangeError, as `momentum()` does. `viewport.dragPan` checks its `inertia` when the drag is pressed, so the throw never comes from a pointer release.

getVelocity ignores a pause before release (B): fixed ef31343e3e

A one-axis zoom moves the other axis when that axis is out of range (B): not a defect in behavior, doc corrected in 0e5ebb5a87. zoomAt always brings every axis inside its clamp: a property law asserts it (`viewport.pbt.test.ts:131`), and labkit's `cameraZoom.ts` sets a zoom through `zoomAt(view, at, 1, { min: scale, max: scale })`. It was `axisZoomFactor`'s doc that was wrong.

interpolateView loses precision when the scales differ by a hair just above the 1e-12 threshold (B): fixed 3921711df9. The pan is now `lerp(x0, x1, expm1(-t·ln r) / expm1(-ln r))`, which has no cancellation, so the threshold is gone.

Extra, outside this area, not fixed: the same far-from-origin precision loss (`panX + world × zoom`) is in callers of `worldToScreen` in `affordances/composeAffordanceLayer.ts`, `domains/modes/modeLayers.ts`, `domains/snap/readoutLayer.ts`, `domains/snap/screen.ts` and `domains/selection/enteredGroupFrame.ts`. These belong to other areas in this batch and I have not filed them anywhere.

Checks:
- Each touched test file alone with `--maxWorkers=1`: pass. That is interpolateView 12/12, fitSize 12/12, useFitOnce 10/10, useDecayLoop 11/11, useVelocityTracker 6/6, sceneNodeClientRect 5/5, useNodeOverlayFrame 14/14 and viewportDragPan 31/31.
- Also run alone before the final squash, when the code was the same as now: viewLaws.pbt 11/11, viewport.pbt 14/14, zoomBounds 18/18, useViewAnimation 19/19 and useHandTool.inertia 7/7, all pass.
- `npm run checks:gate`: 31 of 32 passed and `check:changesets` failed (five changeset titles over 140 characters). I shortened them and folded each fix into its own commit; `npm run check:changesets` then printed "OK — 1938 changeset(s)". The gate rerun after that was refused by a PreToolUse hook ("suite-sized npm script … this is the controller"), so the gate as a whole has not passed since the fix. Only changeset text changed after the run that failed.
- `npm run lint -w <pkg>`: `@weasel-js/core` has no `lint` script. The root `npm run lint` (eslint over `packages apps tests`) passed inside the gate run.
- Tree is clean, with `.skulk/` untouched and out of every commit.