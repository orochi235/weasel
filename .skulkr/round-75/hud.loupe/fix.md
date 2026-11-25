- A pin press is dropped by a long press, double click, or context menu (A): fixed 186b5d8634
- Ring controls stay up after the pointer leaves the canvas (A): fixed 707db451e5
- Canceling a pin drag restores a screen point, not the world point (A): fixed 67aba854e0, on top of 7b01828bd1. That commit adds `LoupeModel.pin` and `holdPin` to `@weasel-js/loupe` as new API, with a minor changeset.
- The docked pin never draws pressed during a click (A): fixed 5e90f493f1
- A failed readback after dispose calls back into the disposed loupe, and a throw in `settled` settles it twice (A): fixed 8485967dad
- Ring controls stay up after the pointer leaves the canvas (B): duplicate of A's controls-on-leave finding (707db451e5)
- Dropping the pin on a rect lens's dock or controls pins the aim there instead of taking the pin back (B): fixed d4424b1425
- Canceling a pin drag restores a screen point, not the world point (B): duplicate of A's cancel-restore finding (67aba854e0)
- The zoom keeps a canceled drag's factor, and a cancel with coordinates leaves `dragging` set (B): fixed 1c6c6225aa

No extra defects found. Each fixed finding's test failed before its fix and passes after it. No calls needed recording in `docs/unruled.md`.

Checks:
- `npm run checks:gate`: first run failed 3 of 33: typecheck (the new tests called `deps()` with no ctx), check:size (`createLoupeModel` at 121 lines) and typecheck:packages (the same typecheck errors). I folded the fixes into the commits that caused them. Rerun: "checks:gate: all 33 passed".
- `npm run lint -w @weasel-js/hud` and `npm run lint -w @weasel-js/loupe`: neither package has a `lint` script, so npm errored with "Missing script". I ran `npx eslint packages/hud/src/loupe packages/loupe/src` instead: no output, so pass.
- `npm run check:changesets`: "OK — 796 changeset(s), 10 with warnings". None of the warnings are from this pass.
- Tests, one file at a time with `--maxWorkers=1`: `pixelReadback.test.ts` 1 passed (1); `pinHandle.test.ts` 10 passed (10); `lensControls.test.ts` 10 passed (10); `model.pin.test.ts` 7 passed (7); `model.test.ts` 29 passed (29); `createLoupe.test.ts` 23 passed (23); `createLoupe.interactive.test.tsx` 17 passed (17); `createLoupe.parked.test.ts` 5 passed (5). No browser tests were touched.
- The tree is clean.

tally: 9 of 9 fixed, 0 extra fixed