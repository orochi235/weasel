## MenuDemo's menu has no outside-press, blur or resize dismissal, so clicking away leaves it open with the opener disabled
- where: apps/site/demos/MenuDemo.tsx:88 (MenuDemo / Panels)
- scenario: Open the menu, then click anywhere else on the page (or switch windows). Focus leaves the `role="menu"` div, so Escape no longer reaches `controller.key`, and nothing calls `attachMenuDismiss` (`packages/menu/src/dismiss.ts`), the shared close-on-press-outside/blur/resize every weasel menu uses. The menu stays drawn, and the "Open menu" button stays `disabled={controller !== null}`, until the user clicks back into a row. Expected: a press outside, a window blur or a resize closes it, as the controller's `onClose` contract ("an item was chosen, or it was dismissed") describes. As a reference implementation it also teaches consumers to skip the dismiss wiring.
- evidence: read
- severity: medium

## MenuDemo's "Show grid" entry is built from a snapshot of `grid`, so its checkmark and toggle are frozen at open time
- where: apps/site/demos/MenuDemo.tsx:13 (entriesFor) and :94 (open)
- scenario: `entriesFor(grid, …)` bakes `checked: grid` and `run: () => setGrid(!grid)` from the render that pressed Open. The item has no `keepOpen`, so today the menu closes on run and the next open rebuilds it. But any path that keeps the menu open past a toggle (adding `keepOpen`, which the controller supports for exactly checkbox rows) would show a stale check and toggle to the same value twice. Low today; it is the snapshot shape that is wrong for a checkbox row.
- evidence: read (controller `choose` in packages/menu/src/controller.ts:103)
- severity: low

## LayoutDemo's added tile is posed outside G, not at "G's bottom-right corner" as the comment says
- where: apps/site/demos/LayoutDemo.tsx:55 (addTile)
- scenario: G is 180×180 (`data/layout.scene.json`), so a 30×30 tile at G-local `{ x: 75, y: 185 }` sits below G's bottom edge and centered-left, not in its bottom-right corner (that would be `{ x: 150, y: 150 }`). If the tileGrid layout reflows on add the pose is overwritten and only the comment is wrong; if a reflow does not run on `scene.add`, the new child is drawn outside its container until something else reflows it. Inference on the second half: I did not trace whether `scene.add` triggers a layout pass.
- evidence: read
- severity: low

## Lines3dDemo and LabLoupeDemo's ForeignGl spin a frame loop forever when the WebGL context can't be created
- where: apps/site/demos/Lines3dDemo.tsx:54 (loop) and apps/site/demos/LabLoupeDemo.tsx:142 (ForeignGl loop)
- scenario: Both frame callbacks call `self.request()` / `loop.request()` first and only then bail out on a missing context (`if (!target || !canvas) return;`, `if (!g || !canvas || !source) return;`). On a browser where `getContext('webgl2')` / `getContext('webgl')` returns null (WebGL disabled, context limit reached), the setup effect returns early, `pass.current` / `gl.current` stays null forever, and the loop re-requests every frame for the life of the page doing nothing. Expected: request the next frame only once there is something to draw, or stop when setup failed.
- evidence: read
- severity: low

## LabLoupeDemo's `compile` never checks compile or link status, so a shader failure renders silently black
- where: apps/site/demos/LabLoupeDemo.tsx:115 (compile)
- scenario: `compileShader`/`linkProgram` results are never read (`getShaderParameter(…, COMPILE_STATUS)`, `getProgramParameter(…, LINK_STATUS)`); `gl.createProgram()` returning null on a lost context is also unchecked although the return type is declared non-null. A driver that rejects the fragment shader (e.g. `mediump` precision issues) yields an unusable program, `useProgram` raises a GL error, and the demo draws nothing with no message, while `createShader` failure alone throws. The two failure modes are handled two different ways.
- evidence: read
- severity: low

## Files read
apps/site/demos/KeymapDemo.module.css
apps/site/demos/KeymapDemo.tsx
apps/site/demos/KitSettingsDemo.module.css
apps/site/demos/KitSettingsDemo.tsx
apps/site/demos/KneadLabDemo.tsx
apps/site/demos/LabLoupeDemo.tsx
apps/site/demos/LassoDemo.module.css
apps/site/demos/LassoDemo.tsx
apps/site/demos/LayerListDemo.module.css
apps/site/demos/LayerListDemo.tsx
apps/site/demos/LayeredCurveDemo.module.css
apps/site/demos/LayeredCurveDemo.tsx
apps/site/demos/LayoutDemo.module.css
apps/site/demos/LayoutDemo.tsx
apps/site/demos/LevelOfDetailDemo.tsx
apps/site/demos/Lines3dDemo.module.css
apps/site/demos/Lines3dDemo.tsx
apps/site/demos/LoupeDemo.module.css
apps/site/demos/LoupeDemo.tsx
apps/site/demos/LoupeModelDemo.module.css
apps/site/demos/LoupeModelDemo.tsx
apps/site/demos/MeasureLabDemo.module.css
apps/site/demos/MeasureLabDemo.tsx
apps/site/demos/MenuDemo.module.css
apps/site/demos/MenuDemo.tsx
apps/site/demos/MermaidKindsDemo.tsx
apps/site/demos/MinimapDemo.module.css
apps/site/demos/MinimapDemo.tsx
apps/site/demos/ModesDemo.module.css
apps/site/demos/ModesDemo.tsx
apps/site/demos/MoveSnapDemo.tsx
apps/site/demos/MultiSelectDemo.tsx
apps/site/demos/PTouchLabelDemo.module.css
apps/site/demos/PTouchLabelDemo.tsx
apps/site/demos/PageGridDemo.module.css
apps/site/demos/PageGridDemo.tsx
apps/site/demos/PaintDemo.module.css
apps/site/demos/PaintDemo.tsx
apps/site/demos/PaintKindsDemo.module.css
apps/site/demos/PaintKindsDemo.tsx
apps/site/demos/PanZoomDemo.tsx
apps/site/demos/ParallaxDemo.tsx
apps/site/demos/PathAnchorEditDemo.tsx
apps/site/demos/PathConstraintsLabDemo.module.css
apps/site/demos/PathConstraintsLabDemo.tsx
apps/site/demos/PathDirectionLabDemo.tsx
apps/site/demos/PathMotionDemo.tsx
apps/site/demos/PathPoseDemo.tsx

<!-- done: 5 findings, files read: 48 -->
