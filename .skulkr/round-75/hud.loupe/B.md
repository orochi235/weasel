## A lens's ring controls stay up after the pointer leaves the canvas
- where: packages/hud/src/loupe/aimInput.ts:36 (lensAimInput `leave`); packages/hud/src/loupe/lensControls.ts:63 (addLensControls `pointerAt`)
- scenario: the pointer moves near a lens (controls' `near` becomes true), then leaves the canvas. `loupe.leave` reaches `lensAimInput.leave`, which resets the press state but never calls `lens.pointerAt`, and `LensControls` has no way to be told the pointer is gone. `near` stays true, so the mode switch, zoom and pin stay drawn and hit-testable until the pointer comes back and moves far from the ring. The doc says they "hide once it moves away".
- evidence: read
- severity: low

## Dropping the pin on a rect lens's ring pins the aim there instead of taking the pin back
- where: packages/hud/src/loupe/pinHandle.ts:62 (createPinHandle `overLens`)
- scenario: on a `shape: 'rect'` lens, the dock sits outside the window at (right + RIM_GAP, bottom + RIM_GAP), and the controls run below the window. `overLens` for a non-round lens is only `win.hitTest`, so a pin carried back onto its dock or onto the control strip is not "over the lens". Each move there calls `host.pinAt(p)`, and the drop pins the aim on the ring area instead of letting it follow again. The round branch includes the ring (`width/2 + BAND + 8`), and the comment says "Over the lens or its ring", so the two shapes give different answers.
- evidence: read
- severity: low

## Canceling a pin drag restores a screen point, not the world point the pin held
- where: packages/hud/src/loupe/pinHandle.ts:110 (createPinHandle `onPointer`, cancel branch)
- scenario: the lens is pinned. A drag of the target or dock starts, recording `wasAim = host.aim()`, which is a screen point. The camera then pans or zooms (a wheel during the drag), and the drag is canceled. `host.pinAt(was.wasAim)` pins at whatever world point is now under that old screen point, not at the world point that was pinned before. If the lens now covers that screen point, `model.pinAt` refuses it (`refuses` → `surface.covers`), and the pin is left where the drag put it. The cancel should restore the previous pin.
- evidence: read (packages/loupe/src/model.ts:210 `pinAt` refuses covered points)
- severity: low

## The zoom keeps a canceled drag's factor, and a cancel with coordinates leaves `dragging` set
- where: packages/hud/src/loupe/zoomTrack.ts:89 (createZoomTrack `onPointer`)
- scenario: a drag along the zoom calls `setFactor` on every move. A `cancel` event does not restore the factor from before the press: the lens stays at whatever stop the canceled drag reached. The pin handle restores its prior state on cancel (pinHandle.ts:108), and the mode switch commits only on `up`, so each control answers "what does cancel undo" differently. Also, a `cancel` that carries finite `x`/`y` matches no branch, so `dragging` stays `true` (only an `up`, or an event without finite coords, clears it). It is then held in `deps` until the next press.
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

<!-- done: 4 findings, files read: 16 -->
