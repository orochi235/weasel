Held keys replayed for `over` bindings even when a field, control, menu, or modal had refused them (A) — fixed 1a12db593a; also the half where a widget stopped the keyup — fixed 5338ea504e
A held key never engaged its `over` binding again after a cancel or tool switch ended the gesture without a keyup (A) — fixed d2cbafac28
The gesture's cursor stayed on screen after a gesture ended with no input behind it (blur, cancelAll) (A) — fixed 788913d82c
The same stuck cursor (B) — duplicate of the cursor finding from A, fixed 788913d82c
Immediate params dropped `bodyKind` for pointerdown, longpress, and hover (A) — fixed 59e717f8f4 (click and doubleclick now carry `bodyTarget`, `bodyKind`, and the client point too)
The same `bodyKind`/`bodyTarget` gap (B) — duplicate of the `bodyKind` finding from A, fixed 59e717f8f4
`ctx.screen` was canvas-local for wheel and pinch (A) — fixed d023189ede (`WheelEvent`/`PinchEvent` gain an optional `screen` holding the client point; `clientX`/`clientY` stay canvas-local, which the wheel zoom anchor relies on; minor changeset because it adds API)
A failed drop item read surfaced as an unhandled rejection (A) — not a defect (`itemsFromDataTransfer` never rejects: `getAsFile` and `getAsString` don't fail asynchronously, no file is read until an action reads it, and `dispatch` already catches and logs an invoker's throw)
`heldPointer` was read once at attach, so a new callback never got the feed and the old one never got `null` (B) — fixed 9ba4de092a
A keystroke that closed a keymap with Cmd down stayed in the `quiet` set when its keyup was lost (B) — fixed 5afe526805

No extra defects found.

Checks:
- `npx vitest run --maxWorkers=1`, one file at a time:
  - `useGestureDispatcher.keyScope.test.tsx`: pass (24)
  - `channels/overKeys.test.ts`: pass (2)
  - `useGestureDispatcher.hoverCursor.test.tsx`: pass (9)
  - `inputFacts.test.ts`: pass (6)
  - `dispatcher.eventPoint.test.ts`: pass (14)
  - `useGestureDispatcher.heldPointer.test.tsx`: pass (1)
  - `channels/keymapKeys.test.ts`: pass (2)
  - Neighboring files also pass: `keyHeld`, `keyHeld.sharedKey`, `heldKeyViews`, `hover`, `paintedCursor`, `dispatcherWatch`, `immediate`, `carried`, `targetKind`, `click`, `listeners`, `abandon`, `cmdKeyup`, `pageKeys`, `offhand`, `keymap`, `wheelMidDrag`, core's `viewport.safari.integration`, kernel3d's `cameraRig`, and core's `SceneCanvas` directory (425 tests).
- `npm run checks:gate`: pass ("all 33 passed"). The first run failed on `check:changesets` (the wheel changeset needed `minor`) and `check:size` (`hoverCursorInput` and `keyboardInput` were over 120 lines). Both are fixed and folded into their commits.
- `npm run lint -w @weasel-js/routing` and `-w @weasel-js/gestures`: neither package has a `lint` script ("Missing script"). Ran `npx eslint` on the dispatcher directory and `inputFacts.ts` in gestures: pass.
- Tree clean; `.skulkr/` untouched.

tally: 10 of 10 fixed, 0 extra fixed