# Audit round 50 — kernel3d — findings

## Marquee hit test casts through the factory's view, ignoring the asking view's `viewId`, while the pick reads it
- where: packages/kernel3d/src/deps.ts:123 (createAreaSelect3dDep → hitTestArea)
- scenario: one `createAreaSelect3dDep(world, sel)` serves a surface with two `<CanvasView>`s ('top', 'side'); a marquee drawn in 'side' calls `hitTestArea(bounds, { viewId: 'side', layerIsPainted })`. The rectangle is tested against `viewportOf(world, viewId /* factory's, undefined */)`, i.e. the surface camera, while the layer gate is 'side''s — it selects whatever lies under that screen rect in a different camera. `createPickNearest` (deps.ts:92) answers the same question by `view?.viewId`, and core's `PickingView.viewId` doc says a non-2D host "reads its own by it". Should use `view?.viewId ?? viewId`. (docs/unruled.md:1709 has each `<CanvasView deps>` carry its own deps, which avoids this when a host does that; a surface-level area-select dep, which `hitTestArea`'s `view` argument exists to serve, still casts through the wrong camera.)
- evidence: read
- severity: low

## An unbounded box earlier in render order erases every box's shared alignment plane (NaN locus)
- where: packages/kernel3d/src/snap/sources.ts:118-128, 139-153 (alignPlaneSource, planesOf)
- scenario: `world.bounds` gives a floor node an infinite box, `{min:{x:-∞,y:-0.1,z:-∞}, max:{x:∞,y:0,z:∞}}` — a box the BVH refuses, which `snapBoxes` returns anyway through `always` (and pickIndex documents non-finite boxes as expected). `centerOf` of it is `{x:NaN, y:-0.05, z:NaN}`, so every `on` point it adds to `planes` has NaN on the two other axes. The floor is first in render order, so for the plane y = 0 that every cube resting on it shares (`box.min.y === 0`), `ends[0]` is the floor's NaN point and the candidate's `locus.at` is `{NaN, 0, NaN}`. `resolveSnap` drops a non-finite locus (geom/src/snap/resolve.ts:138), so dragging a cube can never align to the y = 0 plane the other cubes share; a center plane value of NaN is also offered (`Math.abs(p.at[axis] - NaN) > r` is false). The plane's locus needs only its own axis coordinate; `at` should be a finite point on it (e.g. the first finite end), and non-finite values/ends skipped.
- evidence: read
- severity: medium

## A level drag under a tilted `up` overwrites one world axis, leaving the level plane and the pointer
- where: packages/kernel3d/src/screenPose.ts:38-53 (movedOnLevel, draggedOnLevel), reached from deps.ts:255-257 (translate with no landing)
- scenario: `World3d.up = { x: 0, y: 1, z: 1 }` (the camera supports any up through `orbitFrame`; `groundAxes` names `y` as its axis). With no snap dep, or any session that reports no `Landing3d`, `translate` casts both screen points onto the plane `up · p = up · position`, so `delta` is e.g. `{x: 0.3, y: 0.5, z: -0.5}`. `movedOnLevel` then sets `position.y` back to its old value, applying `{0.3, 0, -0.5}`: the node's height along `up` drops by 0.5/√2 every drag and it lands off the point under the pointer. The snap session answers the same move with the whole in-plane delta (`landingOf` keeps every axis an input direction from `planeBasis(up)` moves along), so the move goes to different places with and without snapping. Pinning one world axis is only right when `up` is that axis; the in-plane delta already keeps the height, so the overwrite should go, or apply only for an axis-aligned `up`. (unruled.md:459 rules rounding for an `up` *just* off an axis, not this.)
- evidence: read
- severity: low

## The 3D pick index's exact-box map keeps an entry for every node id it ever boxed
- where: packages/kernel3d/src/pickIndex.ts:87, 106-110 (WorldIndex.exact / source().ownBox)
- scenario: since f9760950ec the index lives as long as the `world` object and updates incrementally. `ownBox` writes `this.exact.set(id, b)` for each node it boxes, but nothing deletes: when a node is deleted, the reach tree drops its record (`parentOf` → `undefined`, core reachTree.ts:95-97) without calling the source back, so its `exact` entry stays. A long session that inserts and deletes nodes through one world grows `exact` by one Aabb per id ever seen, with no bound; only a new `bounds` function or a new world frees it. The old build-per-version index held only live nodes. Fix: prune on the feed's removed ids, or keep the exact box on the tree's record.
- evidence: read
- severity: low

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

<!-- done: 4 findings, files read: 41 -->
