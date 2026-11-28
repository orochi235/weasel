# hud audit findings

## Any pointer's release cancels every open HUD press, not only the press of the pointer that lifted
- where: packages/hud/src/openPresses.ts:38 (createOpenPresses / sweep)
- scenario: someone holds a stepper chip with a pen (or one finger), and a palm or second touch taps elsewhere on the page and lifts. The window-level `pointerup` sweep snapshots every open press. A task later the held chip's press is still open, so it gets `cancel` while the pen is still down: the repeat stops, and the pen's eventual click sends `up` after the `cancel`. `docs/unruled.md:2441` rules that the cancel comes "a task after *that pointer's* release", and `docs/unruled.md:1914` says a touch beside a held pen does not abandon it. Presses are keyed by widget only; no `pointerId` is recorded or compared.
- evidence: read
- severity: medium
- fix: packages/hud/src/openPresses.ts, packages/hud/src/tool.ts
- size: function
- cause: sweep not keyed by pointerId
- confidence: likely

## A failed `attach` leaves its surface key in the contribution's `surfaces` set
- where: packages/hud/src/tool.ts:221 (createHudContribution attach)
- scenario: one `createHudContribution(hud)` entry is installed on a second canvas while `hud` is already attached elsewhere, or with a `font` pair that differs from the registered one. `surfaces.add(key)` runs first, then `attachHud` throws, and the returned cleanup that would delete the key never exists. `loupeAimActions(hud, surfaces)` then treats that surface as live for as long as the entry exists.
- evidence: read
- severity: low
- size: line
- cause: side effect before a throwing call
- confidence: sure

## Pending sweep timeouts outlive `watch`'s unwatch
- where: packages/hud/src/openPresses.ts:39 (sweep)
- scenario: a pointerup schedules `win.setTimeout(…, 0)`, then the contribution detaches in the same task (for example, the canvas unmounts on that click). The unwatch removes the listeners but not the queued timeout, so a widget still in the HUD's list gets `cancel` after its canvas detached. Teardown leaves a callback behind.
- evidence: read
- severity: low
- size: function
- cause: timeout id not tracked or cleared
- confidence: likely

## glyphCommands hard-codes the icon frame and stroke width that `@weasel-js/icons` exports
- where: packages/hud/src/glyph.ts:142 (glyphCommands), packages/hud/src/glyph.ts:11 (ROOT)
- scenario: `glyphCommands` scales by `at.size / 20`, and `ROOT` sets `'stroke-width': '1.5'`. In the same file, `iconCommands` places the mark slot with `at.size / ICON_FRAME`. The icons package defines `ICON_FRAME = 20` and `ICON_STROKE = 1.5`, so the same decision is answered in two places. If the frame changes, the mark slot and the subject glyph scale differently, and the mark moves off its subject.
- evidence: read
- severity: low
- size: line
- cause: duplicated constant
- confidence: sure

## An opening tag the tag regex can't match still has its closing tag matched, which pops the parent frame
- where: packages/hud/src/glyph.ts:33 (tags), packages/hud/src/glyph.ts:154 (glyphCommands)
- scenario: a glyph body passed to the exported `glyphCommands` contains `<g transform='translate(2 2)'>…</g>` (single quotes), or an attribute written with spaces around `=`. The opening tag fails the regex and yields nothing, so no frame is pushed. The `</g>` does match, and it pops the enclosing `<g>`'s frame. Every later sibling then draws without that group's transform and inherited fill/stroke.
- evidence: read
- severity: low
- size: function
- cause: open and close tags parsed asymmetrically
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
