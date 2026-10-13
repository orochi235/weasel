---
'@weasel-js/core': patch
---

Changes behavior: a controlled `<SceneCanvas view viewBounds>` now hands `onViewChange` a view clamped to `viewBounds`, as an uncontrolled one already did. It used to report the raw view for a pan, zoom, or animation frame, leaving the consumer to clamp. The canvas now holds its view in one place; it kept a second copy with a hand-written controlled fork that skipped the clamp.

Also changes: a controlled view repaints when its numbers change, not when the `view` object's identity does, and a write to an uncontrolled view made before the canvas mounts is applied.

Breaking: `SceneCanvasProps` loses `previewIdsExtra` and `pickBest`, which were never `<SceneCanvas>`'s own and were reachable only through the internal canvas's prop type. `CanvasProps`, the prop type of that unexported component, takes a required `viewState` and already-built `layers`, and drops `view`, `defaultView`, `onViewChange`, `viewBounds`, `pickEvery`, `pickBest`, `previewIdsExtra`, and the three dev HUD flags. The HUD flags on `<SceneCanvas>` work as before.
