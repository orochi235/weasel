---
"@weasel-js/core": patch
---

The default `slice` dep now cuts a path under any pose the pose descriptor can read, not only one with top-level `x`/`y`/`width`/`height`: `useSliceDepSource` takes the canvas's `poseDescriptor` as a new optional last argument, and `<SceneCanvas>` passes it. A rotated shape's pieces keep its rotation in their own poses instead of having it baked into their paths, when the descriptor can write a rotation (`withRotation`); otherwise the rotation is baked in as before. `computeSliceOps`'s `placePiece` now receives the world-space piece and returns `{ pose, path }` (the new `SlicePiece` type) rather than mapping a pose alone, and `SliceBounds` is no longer exported — breaking for callers of that hook, which has not yet been released.

`worldEditToStorage` now places a rotated pose's box so the edited path stays where it was drawn when its bounds change. Before, the rotation pivot moved with the box, so dragging an anchor of a rotated shape past its bounds shifted the whole shape. It also accepts any `Path`, not only a polygon.
