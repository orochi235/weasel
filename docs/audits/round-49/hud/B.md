# Audit round 49 — area `hud` (blind reviewer)

Note: commit 2f3b11aab7ae249a1690ff9a4409dbdf440e5222 is not in this clone (`git cat-file` reports bad object).
The tree read is HEAD d057251407, whose `packages/hud` has no uncommitted changes.

## Two view-backed loupes on one canvas share the view id `weasel-loupe:lens`, so the second replaces the first's view and the first draws the second's picture
- where: packages/hud/src/loupe/vectorLens.ts:14, :60-69 (createVectorLens, `LENS_VIEW`); packages/hud/src/loupe/createLoupe.ts:196 (`id: 'weasel-loupe'`)
- scenario: two `createLoupe({ views: api, … })` calls on one `SceneCanvas` (two `useLoupe`s, say a pixel lens and a vector lens). `addView` in `useSceneCanvasHandle.ts:19` drops any view with the same id (`list.filter((v) => v.id !== props.id)`), so the first lens is no longer a view: its `interactive` routing and `follows` are gone, and its `lens.draw` looks the view up by id (`find((r) => r.id === props.id)`) and paints the *second* lens's camera and bounds inside the first window. `viewAt(…, { except: LENS_VIEW })` also excludes both. Each lens should take an id of its own (the window widget id is likewise the same constant for every loupe).
- evidence: read
- severity: medium

## `useLoupe` drops the pane region on the `source` path, so a pixel lens on a pane of a shared canvas reads the wrong pixels
- where: packages/hud/src/react/useLoupe.ts:60-72 (useLoupe → createLoupe)
- scenario: `useLoupe(ref, hud, layers, …)` with a non-null `source` on a canvas that is one pane of a shared surface (`api.element !== api.surface`). It passes `canvas: api.surface` and `input: api.element` but no `region`, and without `views` `createLoupe` falls back to the whole canvas (`opts.region ?? host?.getSurfaceRect` → undefined, createLoupe.ts:179). The aim is measured against the pane's element while the readback treats it as surface-relative, so pixel mode and the framebuffer color sample read a rect offset by the pane's origin. The `views` path gets `api.getSurfaceRect` and is right; the `source` path should pass `region: api.getSurfaceRect` too (createLoupe's own doc says to).
- evidence: read
- severity: medium

## A loupe window removed with `hud.remove` keeps its canvas view routing input until the next hover
- where: packages/hud/src/loupe/createLoupe.ts:242-249 (teardown), packages/hud/src/loupe/vectorLens.ts:63 (`bounds`)
- scenario: `hud.remove(loupe.window)` on an interactive view-backed lens. The window is disposed but nothing tears the loupe down: teardown runs only from `loupe.dispose()` or from the model's `aimAt` noticing `surface.gone()`. Until a hover reaches `loupe.aim`, the lens view stays on the canvas with `bounds` = the disposed window's `contentRect` (`win.hidden` is still false), so a touch press there is routed through the invisible lens's magnified camera, and the frame subscriber keeps running. The view's `bounds` (and `surface.hidden`) should treat `win.disposed` as gone.
- evidence: read
- severity: low

## `stubHudFonts` replaces `global.fetch` and `global.createImageBitmap` with no restore
- where: packages/hud/src/hudCanvas.fixture.tsx:35-39 (stubHudFonts)
- scenario: a test file calls `stubHudFonts()` in `beforeEach`; the stubs are plain assignments, not `vi.stubGlobal`, so `vi.unstubAllGlobals()`/`restoreAllMocks` never undo them and every later test in the same worker sees the fake `fetch` returning an empty font JSON. The harness's `hud.add(widget)` effect likewise never removes the widget on unmount.
- evidence: read
- severity: low

## `HudHost.registerLayer` is never called, so a custom host as `host.ts` describes it never receives the HUD's layer
- where: packages/hud/src/host.ts:3-9 (HudHost); packages/hud/src/hud.ts:184-189 (bind); packages/hud/src/attach.ts:142, :161
- scenario: a test or headless renderer supplies its own `HudHost` and calls `hud.bind(host)`, as the interface doc invites ("a test or a headless renderer can supply its own"). `bind` stores the host and never calls `host.registerLayer`; the layer, with its draw passes, cache and hit-test, is built only inside `attachHud` (`createLayerDraw`/`createLayerDeps` are not exported). The custom host gets redraw requests and nothing to draw. Either `bind` should hand the host a layer, or the doc and the dead `registerLayer` member should go.
- evidence: read
- severity: low

## A widget removed from the HUD stays in hover and open-press state and gets events after it is disposed
- where: packages/hud/src/hover.ts:15-36 (createHover); packages/hud/src/openPresses.ts:21-31 (createOpenPresses); packages/hud/src/hud.ts:159-165 (remove)
- scenario: the pointer is over a button (or mid-press on it) when `hud.remove(button)` runs. `drop` clears focus but neither the attachment's hover nor the contribution's open presses hear of it, so the next pointer move sends the disposed widget `hoverleave`, and the next `pointerup` sweep sends it `cancel`, each with a redraw. A consumer widget whose handler touches torn-down state throws from inside the layer's `onUncapturedMove`; kit widgets refuse mutation once disposed (`window.ts:124`). The `Map` in `openPresses` also holds the removed widget until a pointerup arrives.
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

<!-- done: 6 findings, files read: 31 -->
