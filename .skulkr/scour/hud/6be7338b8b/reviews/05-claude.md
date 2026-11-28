# hud audit findings

## The hit walk stops at a widget that claims only some gestures, so a gesture it declines skips the widgets beneath it and goes to the scene
- where: packages/hud/src/attach.ts:79 (widgetAt)
- scenario: a widget with `claims: ['wheel']` (or `['contextMenu']`) overlaps a button. A press there: `widgetAt` returns the wheel-only widget, since its claim list is not empty. `hitTest` then returns an exclusive hit whose `claimedKinds` leaves out `pointer`, and `wireFocus`'s pointerdown sees a hit that does not claim `pointer`. The press goes to the scene, and the button underneath never hears it or takes focus. Expected: the walk skips a widget that declines the gesture, just as it skips decoration (`claims: []`), and goes on to the button. As written, only a widget that claims nothing at all is transparent.
- evidence: read
- severity: medium
- fix: packages/hud/src/attach.ts, packages/hud/src/domFocus.ts
- size: design
- cause: hit walk not keyed on the gesture
- confidence: likely

## If `attachHud` throws inside the contribution's `attach`, the surface key stays in `surfaces`
- where: packages/hud/src/tool.ts:211 (createHudContribution attach)
- scenario: `surfaces.add(key)` runs before `attachHud(api, hud, options)`. That call throws when the HUD is already attached (for example, one `useHudContribution(hud)` entry passed to two canvases) or when its font URLs conflict. The key is never removed, so `loupeAimActions(hud, surfaces)` keeps treating a surface the HUD never attached to as installed, for the life of the contribution. Expected: add the key after the attach succeeds, or remove it on the throw.
- evidence: read
- severity: low
- fix: packages/hud/src/tool.ts
- size: line
- cause: state set before a throwing call
- confidence: sure

## Releasing any pointer cancels every open HUD press, including one still held by another pointer
- where: packages/hud/src/openPresses.ts:31 (createOpenPresses sweep)
- scenario: a pen or mouse holds a HUD stepper chip (press opened, auto-repeating), and a touch on the scene ends. The window's `pointerup` sweep copies all of `open`, and one task later sends `cancel` to the chip, though its own pointer is still down. Its later `move`/`up` then arrive after a `cancel`. Expected: the sweep closes only presses made by the pointer that was released or canceled, or by every pointer on window blur. The press is not keyed by `pointerId`.
- evidence: read
- severity: low
- fix: packages/hud/src/openPresses.ts, packages/hud/src/tool.ts
- size: function
- cause: open presses not keyed by pointer
- confidence: likely

## glyphCommands hard-codes the icon frame (20) and stroke width (1.5) instead of using `ICON_FRAME` / `ICON_STROKE`
- where: packages/hud/src/glyph.ts:154 (glyphCommands), packages/hud/src/glyph.ts:11 (ROOT)
- scenario: `iconCommands` scales the mark slot by `at.size / ICON_FRAME`, but `glyphCommands` scales the glyph by `at.size / 20`, and `ROOT` writes `'stroke-width': '1.5'` where `@weasel-js/icons` exports `ICON_STROKE = 1.5`. The same decision is answered in two places. If the icons package changes its frame or stroke, the subject and its mark slot misalign, and the HUD's strokes stop matching `<Icon>`'s.
- evidence: read
- severity: low
- fix: packages/hud/src/glyph.ts
- size: line
- cause: duplicated constants
- confidence: sure

## The hidden text input follows the caret only when the edit changes, so after a scroll or layout shift it sits in the wrong place
- where: packages/hud/src/textInputHost.ts:44 (wireTextInput sync)
- scenario: a HUD text edit is running, and the page scrolls or the canvas moves (a resized pane, a reflow above it). The input is `position: fixed`, and its client coordinates come from `layoutBoxOf(element)` only when `text.subscribe` fires or the canvas takes focus. It stays at the old client position, so the input method's candidate window appears away from the caret until the next keystroke changes the edit. Expected: also re-place it on scroll and resize, or on every HUD frame while an edit runs.
- evidence: read
- severity: low
- size: function
- cause: position synced only on edit change
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

<!-- done: 5 findings, files read: 24 -->
