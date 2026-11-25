I couldn't write `.skulk/out/findings.md` because permission was denied, so the whole document is below. I also didn't check `docs/unruled.md` for these four, so one of them may already be ruled there.

## Two view-backed loupes on one canvas share the lens view id, so the second's view replaces the first's and the first paints the second's picture
- where: packages/hud/src/loupe/vectorLens.ts:14 (LENS_VIEW), :60 (createVectorLens → host.addView); packages/hud/src/loupe/createLoupe.ts:196 (window id `weasel-loupe`)
- scenario: call `createLoupe({ hud, canvas, views: api, mode: 'vector' })` twice on the same canvas (two lenses at different factors, or loupes on two HUDs over one canvas). Both call `host.addView({ id: 'weasel-loupe:lens', … })`. `useAddedViews.addView` (core/src/canvas/SceneCanvas/useSceneCanvasHandle.ts:19) drops any view with the same id, so only the second lens's view stays registered. The first lens's `lens.draw` looks its layer up by id (`list().find((r) => r.id === props.id)`), finds the second lens's layer, and paints the second lens's camera, aim and factor inside the first window. Its `bounds`, `follows` and `interactive` routing are gone too, so an interactive first lens takes no input. What should happen: each lens owns its view, with an id unique to that lens. The window id `weasel-loupe` is fixed in the same way, and the non-host path reuses it as the per-frame layer id `${win.id}:lens`.
- evidence: read
- severity: medium

## A host atlas passed as `font` is never used once the bundled one is registered; the attach logs "failed to register default font" instead, and the docs call a repeat call a no-op
- where: packages/hud/src/fonts/registerDefaultFont.ts:28 (registerDefaultFont); packages/hud/src/attach.ts:63 (loadDefaultFont), :99
- scenario: a HUD attaches with no `font`, which registers `weasel-hud-default` with the bundled URLs. Later a HUD attaches with `font: { metricsUrl, atlasUrl }`: the same HUD re-attached because `useHud(ref, { font })` got URLs on a later render, or a second HUD in the app. `registerFont` → `claimFontUrls` throws because the variant already holds other URLs (font/src/heldFontUrls.ts:20). The async wrapper turns that into a rejection, and `loadDefaultFont` logs it as "failed to register default font". The HUD keeps drawing from the bundled atlas, and its second fetch, which the option exists to avoid, has already happened. The reverse order fails the same way. `registerDefaultFont`'s doc says "calling it again is a no-op", which holds only for identical URLs. What should happen: the docs match what happens, and an `AttachHudOptions.font` pair either takes effect (`replace`) or is refused with a clear message, not a generic load failure.
- evidence: read
- severity: low

## A pointerdown focuses a widget that does not claim `pointer`, though the press itself falls through to the scene
- where: packages/hud/src/domFocus.ts:26-29 (onPointerDown), with packages/hud/src/attach.ts:72 (widgetAt)
- scenario: a focusable widget declares `claims: ['wheel']`, a documented setup ("Anything not listed falls through to the scene"). On a press over it, `hudHitClaiming('pointer')` rejects the hit, so the scene's tool takes the press, and `cursorOf` gives no pointer cursor. But `widgetAt` returns the widget for any non-empty claim set, and `onPointerDown` focuses it. Keyboard focus jumps to a HUD widget that never took the press, and later keys go to its `onKey` instead of the canvas's bindings. Routing and focus answer "does this widget take the press?" two different ways. What should happen: focus on press only for a widget whose claims include `pointer`.
- evidence: read
- severity: low

## The hover tracker keeps a widget removed from the HUD and later sends it `hoverleave` after it is disposed
- where: packages/hud/src/hover.ts:14-37 (createHover)
- scenario: the pointer rests over widget W, so `hovered = W`. Code calls `hud.remove(W)`, which disposes W, or W disposes itself. Nothing tells the hover tracker, so the disposed widget stays reachable from the layer's closure. On the next uncaptured move, `move()` sees `hit !== hovered` and calls `W.onPointer({ type: 'hoverleave' })` on a disposed widget. A detach runs `hover.clear()`, but removal has no equivalent. What should happen: a widget that leaves the HUD is dropped from hover and gets no events after `dispose`.
- evidence: read
- severity: low

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
packages/hud/src/loupe/aimInput.ts
packages/hud/src/loupe/contentWatch.ts
packages/hud/src/loupe/createLoupe.ts
packages/hud/src/loupe/loupeColors.ts
packages/hud/src/loupe/loupeRoutes.ts
packages/hud/src/loupe/pixelReadback.ts
packages/hud/src/loupe/vectorLens.ts
packages/hud/src/measureEnv.ts
packages/hud/src/openPresses.ts
packages/hud/src/pbt.fixture.ts
packages/hud/src/react/index.ts
packages/hud/src/react/useHud.ts
packages/hud/src/react/useLoupe.ts
packages/hud/src/textInputHost.ts
packages/hud/src/tool.ts
packages/hud/src/widget.ts

<!-- done: 4 findings, files read: 31 -->