---
'@weasel-js/core': patch
---

Fix canvas bugs found in audit round eight. A configured `viewport.pinchZoom` keeps its clamp after the canvas's actions change. A departing node glides out through its parallax plane, and not at all from a hidden layer. `edgePan.zone: 0` no longer sends the view NaN. Content bounds are recomputed when the bounds source changes. Pixel picks pass over locked and unpickable nodes, and a bare adapter's picks skip hidden subtrees and consumed children and honor locks. Picking reads a container's inherited paint as it is shown. A stroked node's drawn box follows an inherited stroke's changes. The render worker answers id reads and snapshots when it never starts, refuses animation params it cannot clone at `play`, and its `SceneViewCanvas` repaints on a pixel-ratio change and after a lost context comes back. Clipboard pastes, kit requirements, worker animation programs, marker icons and data previews no longer read keys from `Object.prototype`.
