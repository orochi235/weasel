---
"@weasel-js/core": patch
---

Scene layers can be parallax planes, and every plane can be animated.

- A scene layer takes `parallax` (`systemLayers`, `addLayer`, and the new undoable `scene.setLayerParallax(layer, opts | undefined)`), and it round-trips through `toJSON`. `<SceneCanvas>`, `SceneViewCanvas` and `renderSceneToPixels` draw that layer's nodes through the derived view, with no wiring by the consumer.
- Nodes on such a layer are picked where they are drawn: a click, a marquee, a lasso and the selection box all go through the plane. Editing them — move, resize, snapping — does not yet; see "Interactive parallax planes" in `docs/TODO.md`.
- **Breaking:** `createParallaxLayer` takes its factors as `parallax: { pan, zoom, anchor }` instead of top-level `pan` / `zoom` / `anchor`. `parallax` also accepts a `ParallaxPlane` from `createParallaxPlane(opts)`, whose `set(patch)` repaints the layer — write it from an animator's `onTick` to tween a plane.
- New pure helpers for crossing between the camera and a plane: `planeMap(camera, opts)`, `toPlane`, `fromPlane`, `rectToPlane`, `rectFromPlane`, and the `PlaneMap` type.
- `HitTestView` gains an optional `get`: a custom `areaSelect` / `lassoSelect` dep reads the asking view's camera from it.
