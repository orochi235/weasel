Press on the curve inserts an anchor out of x order (A+B): fixed b4990cfa2e

Unmount mid-drag never sends `onInput` the start state or fires `onCancel` (A): fixed 1a357bdbce

Consumer that previews through `onInput` without writing it back never gets the drag committed (A): fixed ccc74f72a2

Click-empty insert on a `'function'` layer can land on an existing anchor's x (A+B): fixed b8edfaa976

Crowding threshold uses the plot's x span, not the `xClamp` span drags use (A+B): fixed 6b8746f3af

Undo/redo compares layer states by identity, so an unchanged layer is reported as edited (A): fixed 385128c47e

Canceling a keyframe key drag keeps the press's selection (A): fixed 0f821f96f2

Rim-contour story's seam drag piles interior anchors on the seam and Escape doesn't undo it (A+B): fixed bce5bbbd76 (story only, so no changeset)

Click-curve layer deleted below two anchors can never get a point back (B): fixed 4bb10e12e4. This was my own call, recorded in `docs/unruled.md`: such a layer takes a click anywhere until it has two anchors, instead of holding `minPoints` at 2.

Keyframe `xClamp`/`yClamp` given high end first collapse to one value (B): fixed 456ee30ff4. The pending `clamps-call-geom` changeset said these clamps settle on the low bound, so I dropped that clause from it.

Arrow key on a flat keyframe segment's handle rewrites its hidden y (B): fixed 02bb593853. The helper move in c597d2ee89 is part of the same fix.

Declined edit still records an undo step, so the next Cmd+Z does nothing (B): fixed 444155068b

[r58-16] Key committed by one layer without preventDefault is undone together with the next layer's (carried): not a defect (no longer applies). `dispatchKey` hands each layer's edit to `settleEdit` separately, so each layer gets its own undo step. The existing passing test "records an undo step for each, so one undo reverts only the last" covers it.

Extra: 3f26b65fa3 shortens nine changeset titles that `check:changesets` rejected. c597d2ee89 reorders `useLayerGesture`'s callbacks for a `react-hooks/immutability` lint error, and moves the flat-segment rule into `nudgedBezier` so `createKeyframeLayer` fits `check:size`. Both repair failures my own commits introduced, so I don't count them as extra defects.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: functionAnchorEdits.test.ts pass (13), CurveEditor.history.test.tsx pass (11), createKeyframeLayer.test.tsx pass (34), keyframeEdits.test.ts pass (1), LayeredCurveEditor.editProtocol.test.tsx pass (12), LayeredCurveEditor.stories.test.tsx pass (3). Every other non-browser CurveEditor test file also passed, including CurveEditor.test.tsx (50).
- `npm run checks:gate`: "checks:gate: all 32 passed". The first run failed check:changesets, check:size and lint; all three were fixed as described above.
- `npm run lint -w @weasel-js/ui`: fails because the package has no lint script. The root `lint` inside the gate covers it and passed.
- Browser tests: none touched.

tally: 12 of 13 fixed, 0 extra fixed