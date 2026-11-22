---
'@weasel-js/core': minor
---

A scene can stream from a source around the view, each cell's nodes added as it loads and dropped as the view leaves, outside undo history.

A `SceneSource` names a `cellSize` and answers `load(cell, signal)` with the cell's nodes. `useSceneStream(scene, source, { maxConcurrent, maxCells, margin, lead })` gives a stream whose `update(view, dims)` goes in `<SceneCanvas onViewChange>`; it loads on-screen cells first, then the margin, then where a fling lands. A pan writes no undo entries, and the visibility index updates node by node.

<!-- entry: rank=10 new api -->
