---
'@weasel-js/core': patch
'@weasel-js/d3': patch
'@weasel-js/diagram': patch
---

Pose geometry is supplied once. `<SceneCanvas poseDescriptor={…}>` tells every
built-in action, the selection chrome, picking and area select how to read and
rewrite this scene's poses; it defaults to `AUTO_POSE_DESCRIPTOR` (rect and
`Path` poses). A pose of any other shape now works end to end — before, dragging
one into a container wrote `NaN` into it.

Breaking:

- `PoseProjection` is renamed `PoseDescriptor`, and gains a required
  `fromBounds(bounds, template)` and an optional `withRotation(pose, rotation)`.
- `ResizePose` and `AlignBounds` are removed; use `Bounds`.
- `RotateGeometry`, `AlignBoundsProjection` and `RECT_ALIGN_PROJECTION` are
  removed.
- Removed options, replaced by the descriptor: `selectTool.resize.geometry` and
  `useResizePolicy({ projection })` (use `<SceneCanvas poseDescriptor>`);
  `UseRotateOptions.geometry` and `UseMoveOptions.translatePose` (both were
  unread); `poseBounds` on `useSelectTool`, `arrayAdapter`, `sceneToAdapter`,
  `MinimapCanvas` and `nestedHitTester` (use their `poseDescriptor` option);
  `arrayAdapter`'s `intersectsRect` and `translatePose`; the selection overlay's
  `getBounds` and `fromBounds`; the alignment behaviors' `projection`.
- `Canvas`'s `geometry` prop is renamed `poseDescriptor`. `SceneCanvas`'s own
  `geometry` prop — the `pickEvery` / `boundsOf` hit-test overrides — is a
  different prop and keeps its name.
- `computeFitView`'s fourth argument is a `PoseDescriptor`, not a bounds
  function.
- `sceneToAdapter`'s `cascadeContainerPose` is a boolean; the cascade translates
  through the descriptor.
- The kit's built-in painters only draw rect poses. A node with any other pose
  needs its own painter.
- `Scene` has a read-only `registry`. For a custom pose kind,
  `unionOfChildrenVia(descriptor)` builds the container-union function to
  register under `UNION_OF_CHILDREN`.
