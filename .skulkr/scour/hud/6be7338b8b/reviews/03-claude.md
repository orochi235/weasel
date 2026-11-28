# hud audit findings

## Another pointer's release cancels a press that is still held
- where: packages/hud/src/openPresses.ts:38 (createOpenPresses → sweep / watch)
- scenario: finger A presses a HUD stepper chip and holds it, so it repeats. Finger B (or a pen or mouse) presses and releases anywhere in the window, outside the canvas or on scene content that does not start a pinch. B's `pointerup` reaches the window-capture `onEnd`, which snapshots every open press, A's included. A task later, A's widget gets `cancel` while A is still down: the stepper stops repeating and the button stops showing as lit. When A lifts, the dispatcher's click sends `up` to a widget that has already been canceled. `docs/unruled.md` (2026-11-13) rules that the `cancel` follows "that pointer's release, cancel or a window blur". The sweep ignores `pointerId` and closes every press on any pointer's release.
- evidence: read
- severity: medium
- fix: packages/hud/src/openPresses.ts, packages/hud/src/tool.ts
- size: function
- cause: sweep not keyed by pointerId
- confidence: likely

## `hud.release` and `hud.drag` keep sending events to a widget removed or disposed after the press
- where: packages/hud/src/tool.ts:84 (releaseAction), packages/hud/src/tool.ts:107 (dragAction onMove/onEnd)
- scenario: a widget removes itself from the HUD on `down`, as a menu row or popup that closes on press does, or the app calls `hud.remove(w)` during a drag. The click's `up`, and the drag's `move`, `up` or `cancel`, still reach `widget.onPointer` from the affordance payload captured at press, so a disposed widget handles input. The rest of the package decides this the other way: `onHud` (openPresses.ts:16) says "a widget taken off it hears nothing more from the pointer", and both hover (`live`) and the open-press sweep check it before delivering anything. These two paths never check.
- evidence: read
- severity: low
- fix: packages/hud/src/tool.ts
- size: function
- cause: missing onHud liveness check on dispatcher paths
- confidence: sure

## The hidden IME input is placed only when the edit changes, so it is left behind when the canvas moves on the page
- where: packages/hud/src/textInputHost.ts:46 (sync)
- scenario: a text edit is running in a HUD widget. The page scrolls, or the layout moves or resizes the canvas, and the caret's canvas-px rect does not change. `sync` runs only on focus changes, on the `textInput` subscription and on canvas focus, so the `position: fixed` input keeps the client coordinates of the old `layoutBoxOf(element)`. The platform's IME candidate window then opens at the stale spot, away from the caret. Nothing repositions the input on scroll or resize.
- evidence: read
- severity: low
- fix: packages/hud/src/textInputHost.ts
- size: function
- cause: position cached without layout invalidation
- confidence: likely

## Files read
packages/hud/src/accessibleMirror.ts
packages/hud/src/actionParamSchema.ts
packages/hud/src/attach.ts
packages/hud/src/boxShadow.ts
packages/hud/src/colors.ts
packages/hud/src/domFocus.ts
packages/hud/src/fonts/registerDefaultFont.ts
packages/hud/src/glyph.ts
packages/hud/src/host.ts
packages/hud/src/hover.ts
packages/hud/src/hud.ts
packages/hud/src/hudCanvas.fixture.tsx
packages/hud/src/index.ts
packages/hud/src/layerDeps.ts
packages/hud/src/layerDraw.ts
packages/hud/src/measureEnv.ts
packages/hud/src/openPresses.ts
packages/hud/src/pbt.fixture.ts
packages/hud/src/react/index.ts
packages/hud/src/react/useHud.ts
packages/hud/src/react/useLoupe.ts
packages/hud/src/textInputHost.ts
packages/hud/src/tool.ts
packages/hud/src/widget.ts

<!-- done: 3 findings, files read: 24 -->
