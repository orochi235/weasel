# Audit round 75 — hud.loupe

## A long-press (or any other unhandled event) during a pin press drops the press without finishing or undoing it
- where: packages/hud/src/loupe/pinHandle.ts:110 (createPinHandle onPointer)
- scenario: once `press` is set, every event that is not `hovermove`/`hoverleave`/`down`/`move` reaches `const was = press; press = null;`, and then `if (evt.type !== 'up') return;`. The HUD sends `longpress` (touch/pen held still for LONG_PRESS_MS, see packages/hud/src/longPress.integration.test.tsx:44) and `contextmenu`/`doubleclick` to the widget under the press. A touch user who presses the docked pin and holds it a moment before dragging gets `longpress`: the press is thrown away, later `move`s are ignored (`if (!press) return`), the needle never follows the finger, and the `up` neither toggles nor drops. If the drag had already pinned the aim off the lens (`host.pinAt(p)` on each move) and then paused, the aim is left at the last move point even though a drop back over the lens should have set `follow`, and nothing restores `was.was`. Should ignore event types it does not handle instead of consuming the press.
- evidence: read
- severity: medium

## The ring controls stay up after the pointer leaves the canvas
- where: packages/hud/src/loupe/aimInput.ts:36 (lensAimInput leave); packages/hud/src/loupe/lensControls.ts:62 (pointerAt)
- scenario: the controls show while `near` is true, and only `pointerAt` updates `near`. It is called from `aimAt` but never from `leave()`. With the default round lens at (48,48), the ring bounds plus NEAR reach past the canvas's top-left edge, so moving the pointer off the canvas from beside the lens fires `loupe.leave` with `near` still true. The zoom, mode switch and pin stay drawn (and hit-testable) over the canvas until the pointer comes back. The lensControls doc says they "hide once it moves away". `leave` should clear `near` (e.g. call `pointerAt` with an off-ring point, or add a `leave` to LensControls).
- evidence: read
- severity: low

## Canceling a pin drag restores the old pin at a screen point, not its world point
- where: packages/hud/src/loupe/pinHandle.ts:113 (createPinHandle onPointer, cancel branch)
- scenario: a press on a pinned lens's target or dock stores `wasAim: host.aim()`, a screen point. A drag then calls `host.pinAt(p)` on each move, replacing the pin. If the camera moves during the drag (wheel or trackpad pan, or a programmatic camera change) and the press is then canceled, `host.pinAt(was.wasAim)` pins whatever world point is now under the old screen position. The pin the user had is not restored, and the aim lands somewhere else in the content. The world point needs to be captured at press time (or the model's pin saved and restored).
- evidence: read
- severity: low

## The docked pin never draws pressed while a press is held on it
- where: packages/hud/src/loupe/pinHandle.ts:71 (createPinHandle deps) / :61 (dockOf)
- scenario: `dockOf` draws the dock `on` when `press?.from === 'dock'`. But `deps` reads only `press?.at`, which stays `undefined` from `down` until the press moves past SLOP, and a `down` changes nothing else in deps or bounds. So the HUD reuses the cached commands, and the dock shows no pressed state for the whole of a click on it. The pressed look appears only once something unrelated invalidates the cache. deps should include whether a press is in hand and what it grabbed.
- evidence: read
- severity: low

## A failed readback after dispose still calls back into the disposed loupe
- where: packages/hud/src/loupe/pixelReadback.ts:103 (createPixelReadback read, catch)
- scenario: the success path checks `disposed` before calling `settled`, but the `.catch` does not. If a loupe is disposed while an async region read (or `createImageBitmap`) is in flight and that promise rejects (a context lost on teardown is the likely case), `settled(false)` runs after dispose and calls `requestRedraw()` for a lens that no longer exists. The catch also traps a throw from `settled` on the success path, which calls `settled` a second time. It should check `disposed`, and catch only the read and decode, not the callback.
- evidence: read
- severity: low

## Files read
packages/hud/src/loupe/aimInput.ts
packages/hud/src/loupe/contentWatch.ts
packages/hud/src/loupe/createLoupe.ts
packages/hud/src/loupe/halo.ts
packages/hud/src/loupe/lensControls.ts
packages/hud/src/loupe/lensTone.ts
packages/hud/src/loupe/loupeColors.ts
packages/hud/src/loupe/loupeRoutes.ts
packages/hud/src/loupe/modeSwitch.ts
packages/hud/src/loupe/pinDraw.ts
packages/hud/src/loupe/pinHandle.ts
packages/hud/src/loupe/pixelReadback.ts
packages/hud/src/loupe/rimTracks.ts
packages/hud/src/loupe/textAlong.ts
packages/hud/src/loupe/vectorLens.ts
packages/hud/src/loupe/zoomTrack.ts

<!-- done: 5 findings, files read: 16 -->
