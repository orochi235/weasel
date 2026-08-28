---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

`useNodeOverlayFrame`: the coordinate frame a DOM overlay pinned to a node needs

Nothing in the kit exported one, so consumers hand-rolled it — their own
`ResizeObserver` next to the existing `useCanvasSize`, and a translate-and-scale
inverse built by projecting two points. That inverse silently drops
`pose.rotation`, which is why on-canvas gradient handles on a rotated node sat
beside the paint instead of on it.

```ts
useNodeOverlayFrame(scene, containerRef, nodeId, { view })
// → { box, toScreen, toLocal, width, height } | null
```

`box` is the node's composed world box, unrotated — the frame `toScreen` maps
from, and the box to hand `fillInPoseFrame` / `fillToBoundsFrame`. Rotation
lives in the pose→world leg, where it belongs: a node's stored geometry and its
bounds-frame paint are pre-rotation by definition, so neither of those two
changes.

`@weasel-js/ui` gains `SceneGradientHandles`, the scene-aware half of
`GradientHandles`: it reads the gradient out of a node's `fill` **or** its
`stroke` — `slot` is a prop — and commits each drag through `setFill` or
`setStroke` as one undo entry. `GradientHandles` itself stays frame-agnostic.

Also: `isGradientFill` narrows a `FillStyle` to its three gradient members, and
`useCanvasSize` accepts any `HTMLElement` rather than only a `div`.
