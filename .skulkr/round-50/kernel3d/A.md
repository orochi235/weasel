# Audit round 50 — kernel3d (blind reviewer)

## The 3D pick index's exact-box map keeps an entry for every node ever boxed, deleted ones included
- where: packages/kernel3d/src/pickIndex.ts:87,109 (WorldIndex.exact / source().ownBox)
- scenario: a long editing session inserts and deletes nodes (or a host streams nodes in and out); `ownBox` sets `exact.set(id, b)` for each, and nothing deletes an id when it leaves the scene, so the map grows with every id ever indexed (holding each one's Aabb) for the life of the world, while the tree itself drops them. Should drop an id's entry when the node leaves the scene.
- evidence: read
- severity: low

## `camera.pinchDolly` subtracts the pane's canvas origin from a centroid that is already view-local
- where: packages/kernel3d/src/tools.ts:196,199 (cameraPinchDollyAction.start → paneAnchor)
- scenario: a 3D camera in a `<CanvasView>` whose dispatcher target has a `clientToLocal`, with `createCameraDep(world, { origin: () => paneTopLeftOnCanvas })` so the wheel anchors right. The wheel's `clientX/Y` is canvas-local (`toCanvasLocal`, routing `channels/wheel.ts:37`), so subtracting `origin` makes it pane-local — correct. A two-finger pinch's `multiTouch.centroid` is reported through `toViewLocal` (`dispatchCore.ts:204`; doc in `invoker.ts:146` "from the top-left of the view the gesture runs in"), so it is already pane-local, and `paneAnchor` subtracts `origin` a second time: the dolly anchors `origin` pixels up-left of the fingers, and the point under them drifts as you pinch. One `paneAnchor` answers two different input spaces; the pinch should not subtract the origin (or the two should be brought to one space).
- evidence: read (routing's wheel and multitouch channels and kernel3d's `paneAnchor`); not run
- severity: medium

## The line pass drops a whole segment when one end is behind the eye, where the CPU projection clips it
- where: packages/kernel3d/src/lines/pass.glsl.ts:46 (LINE_VS main)
- scenario: a `Line3` with a long straight segment running from in front of the camera to behind it — a ground-grid line under an orbit camera at low pitch, a path the camera sits beside, a two-point axis line through the scene: `ca.w > 0`, `cb.w <= 0`, so all six shaft vertices (and the head) go to `CULLED` and the visible half of the segment disappears; the longer the segments, the more of the line vanishes as the camera moves in. The visible stretch should be drawn, the end clipped where it crosses the near plane (`w` at `near`), which is exactly what `projectAabbToScreen` (`screen.ts:136-141`) does for box edges, arguing that dropping instead "reports a box that is too small for anything straddling the near plane". The same question — a segment straddling the near plane — is answered two ways, and the GPU one loses geometry.
- evidence: read; not run
- severity: medium

## The 3D pick index boxes a node at its shown pose but with its stored data, where core's boxes it wholly as shown
- where: packages/kernel3d/src/pickIndex.ts:106-108 (source().ownBox), via packages/kernel3d/src/world.ts:71 (boxAt)
- scenario: a world whose `bounds` reads `node.data` (a radius, a mesh size, the test scene's `round`), and a preview that writes a data override rather than a pose one (a property scrub, a data tween, a resize that previews through data). `ownBox` hands `boxOf` the stored node, so `nearestOnRay` and `inScreenRect` hit-test the committed extent while the host draws the previewed one: a sphere scrubbed from radius 1 to 3 can't be clicked or marqueed outside its old radius until the commit. Core's 2D pick index answers the same question with `nodeAsShown(scene.overrides, raw)` (`core/src/canvas/pickIndex/scenePickIndex.ts:119`, "Boxed as shown, so a data override that grows a node's ink is met where it is painted"); kernel3d's doc says "every node's world box as shown" but only the pose is.
- evidence: read (both indexes); inferred that the touched-ids feed carries data-override changes, since core's index relies on the same feed for them; not run
- severity: low

## The 3D marquee tests through the factory's camera and ignores the asking view's `viewId`, which the pick reads
- where: packages/kernel3d/src/deps.ts:123-124 (createAreaSelect3dDep → hitTestArea)
- scenario: a surface with a second 3D `<CanvasView>` that does not get its own `areaSelect` dep (the canvas-level one answers for it, as any dep a view does not carry does). A marquee drawn in that view calls `hitTestArea(bounds, view)` with `view.viewId = 'side'` and that view's layer gate; the dep casts through `viewportOf(world, viewId)` with its own `viewId` (undefined → the surface's camera), so the rectangle drawn in the side view selects what lies under it in the main view, filtered by the side view's layers. `PickingView.viewId` exists for this ("A host whose camera is not a 2D `View` reads its own by it", core `adapters/types.ts:116`), and `createPickNearest` in the same file does read it (`view?.viewId`, line 92). The marquee should use `viewId ?? view?.viewId` (or the view's id outright), as the pick does.
- evidence: read; not run
- severity: medium

## Files read
packages/kernel3d/src/actionParamSchema.ts
packages/kernel3d/src/aim.ts
packages/kernel3d/src/axisMove/action.ts
packages/kernel3d/src/axisMove/handles.ts
packages/kernel3d/src/camera.ts
packages/kernel3d/src/cameraBindings.ts
packages/kernel3d/src/cameraDep.ts
packages/kernel3d/src/cameraRig.ts
packages/kernel3d/src/composePose3.ts
packages/kernel3d/src/createCameraDep.ts
packages/kernel3d/src/deps.ts
packages/kernel3d/src/ground.ts
packages/kernel3d/src/icons.gen.ts
packages/kernel3d/src/icons.table.ts
packages/kernel3d/src/index.ts
packages/kernel3d/src/insert.ts
packages/kernel3d/src/kitSettings.ts
packages/kernel3d/src/lines/head.ts
packages/kernel3d/src/lines/pack.ts
packages/kernel3d/src/lines/pass.glsl.ts
packages/kernel3d/src/lines/pass.ts
packages/kernel3d/src/logDepth.ts
packages/kernel3d/src/overlays.ts
packages/kernel3d/src/pathMotion3.ts
packages/kernel3d/src/pbt.fixture.ts
packages/kernel3d/src/pickIndex.ts
packages/kernel3d/src/pose3.ts
packages/kernel3d/src/project.ts
packages/kernel3d/src/screen.ts
packages/kernel3d/src/screenPose.ts
packages/kernel3d/src/snap/boxIndex.ts
packages/kernel3d/src/snap/landing.ts
packages/kernel3d/src/snap/marks.ts
packages/kernel3d/src/snap/plane.ts
packages/kernel3d/src/snap/probes3d.ts
packages/kernel3d/src/snap/session3d.ts
packages/kernel3d/src/snap/sources.ts
packages/kernel3d/src/testScene.ts
packages/kernel3d/src/toolSets.ts
packages/kernel3d/src/tools.ts
packages/kernel3d/src/world.ts

<!-- done: 5 findings, files read: 41 -->
