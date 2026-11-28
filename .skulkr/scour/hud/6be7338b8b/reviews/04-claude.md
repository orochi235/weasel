# hud audit findings

## Any pointer's release cancels every open HUD press, including one still held by another pointer
- where: packages/hud/src/openPresses.ts:31 (createOpenPresses / sweep, watch)
- scenario: finger A presses and holds a stepper chip (`hud.press` → `opened`; a long-press keeps it repeating, so no click/drag closes it). Finger B taps anywhere else (another widget, the scene, or outside the canvas) and lifts. The window-level capture `pointerup` listener snapshots every open press regardless of `pointerId`, and a task later sends `cancel` to A's chip: it stops repeating and unlights while A is still down. Same with a mouse held on a widget while a pen/touch tap lands elsewhere. The ruling in docs/unruled.md (2026-11-13) says the cancel comes after *that pointer's* release; the code has no pointer identity at all. Should record the press's pointerId (or sweep only presses whose pointer ended) and ignore other pointers' ends.
- evidence: read
- severity: medium
- fix: packages/hud/src/openPresses.ts, packages/hud/src/tool.ts
- size: function
- cause: sweep not keyed by pointer
- confidence: sure

## Switching apps or windows drops HUD keyboard focus and ends a running text edit
- where: packages/hud/src/domFocus.ts:70 (wireFocus onBlur); packages/hud/src/textInputHost.ts:94 (onBlur)
- scenario: a HUD widget is focused (or mid text edit through the hidden input); the user Cmd-Tabs to another app and back. The window losing focus fires `blur` on the active element with `relatedTarget === null`, so `hud.focus(null)` runs (and the input path composes '' then calls `on.blur` → `hud.focus(null)`). On return the browser restores DOM focus to the canvas/input, but the HUD's focused widget, its ring and the edit are gone, unlike DOM focus, which survives a window switch. Should skip the blur when `!doc.hasFocus()` / `doc.activeElement` is still the element or input.
- evidence: read
- severity: low
- fix: packages/hud/src/domFocus.ts, packages/hud/src/textInputHost.ts
- size: line
- cause: window blur treated as focus leaving
- confidence: likely

## A failed attach leaves the surface registered in the HUD contribution
- where: packages/hud/src/tool.ts:213 (createHudContribution attach)
- scenario: `surfaces.add(key)` runs before `attachHud(api, hud, options)`, which throws when the HUD is already attached to another canvas, or when its `font` pair conflicts with another HUD's registration (both documented throws). The throw skips the returned detach, so `key` stays in `surfaces` forever and `loupeAimActions(hud, surfaces)` keeps treating that surface as one the entry is installed on. Should add the key after `attachHud` succeeds (or remove it in a catch).
- evidence: read
- severity: low
- size: line
- cause: side effect before a throwing call
- confidence: sure

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
