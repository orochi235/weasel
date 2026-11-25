- two loupes on one canvas share the view id `weasel-loupe:lens` (A+B): fixed a9ffdff868
- a `font` pair conflicting with the registered HUD font only logs "failed to register default font", and the doc's "no-op" claim was wrong (A): fixed e1cb0cfcfc. I made a strict call here: `attachHud` now throws a clear error and attaches nothing. A host that wants another atlas registers it under a family of its own and passes the name. Recorded in `docs/unruled.md`.
- a press focuses a widget that doesn't claim `pointer` (A): fixed 30fccf4a8d
- a widget removed while hovered gets `hoverleave` after it is disposed (A): fixed 5f8dac026d
- two loupes share one view id (B): duplicate of A's loupe id finding, fixed a9ffdff868
- `useLoupe`'s `source` path drops the pane region, so a pixel lens on a shared canvas reads offset pixels (B): fixed d18a493c96
- a loupe window removed with `hud.remove` keeps routing input to its lens view (B): fixed 6cc19fec24. The lens view now routes nothing once its window is disposed, and the loupe tears down on the next frame.
- `stubHudFonts` replaces `fetch`/`createImageBitmap` with no restore, and the harness never removes its widget (B): fixed c27bb0f0c7. Test-only, so no changeset.
- `HudHost.registerLayer` is never called (B): fixed 4cd68fdc83. The member is removed and the doc corrected; the changeset is `major`/`breaking`, since a host object literal that still sets it fails to typecheck.
- a removed widget stays in hover and open-press state (B): duplicate of A's hover finding, fixed 5f8dac026d. The same fix covers open presses: the next `pointerup` sweep sends no `cancel` to a widget taken off its HUD or disposed. To make that possible, `HudHit…`'s payload type `HudHitPayload` gains an optional `hud`, so that changeset is `minor` with an `api` tag.

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time: all pass.
  - `loupe/createLoupe.test.ts` 23/23
  - `attach.fontConflict.test.ts` 1/1
  - `attach.fontLoad.test.ts` 2/2
  - `attach.focus.test.ts` 23/23
  - `attach.test.ts` 26/26
  - `longPress.integration.test.tsx` 12/12
  - `react/useLoupe.test.tsx` 3/3
  - `hudCanvas.fixture.test.tsx` 2/2
  - `focus.test.ts` 14/14
  - `hud.test.ts` 15/15
  - `menu/attachMenuHost.test.ts` 24/24
  - `loupe/createLoupe.exact.test.ts` 2/2
  - `loupe/createLoupe.parked.test.ts` 5/5
  - `widgets/window/window.integration.test.tsx` 2/2
- Each new test was run against the pre-fix source and failed there.
- `npm run checks:gate`: "checks:gate: all 32 passed".
- `npm run lint -w @weasel-js/hud`: did not run, because `@weasel-js/hud` has no `lint` script. The gate's root `npm run lint` passed.
- No `*.browser.test.*` file was touched.
- The tree is clean.

tally: 10 of 10 fixed, 0 extra fixed