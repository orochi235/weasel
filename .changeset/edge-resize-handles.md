---
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

A selection now has a resize handle at the middle of each edge as well as each corner. Dragging one resizes along that axis only, with the opposite edge pinned; on a rotated node it moves along the node's own axis, and shift keeps the aspect, growing the other axis about its center. The handles report `handle:top`, `handle:right`, `handle:bottom`, and `handle:left`, carry a resize cursor along their axis turned with the node, are drawn by the selection overlay alongside the corners, and are hit ahead of any node body, so a press just outside a selected node's edge resizes it rather than moving the node behind. A side under six handle radii on screen (48 px at the default size) gets no edge handles, so a small node keeps its corners and a body to grab.

On by default. `<SceneCanvas selectTool={{ resize: { edgeHandles: false } }}>` turns them off; `createCornerResizeAffordance({ edges })` and the selection overlay's `edgeHandles` option do the same where those are used directly. The handle layout is one table, `RESIZE_HANDLE_ANCHORS` (corners first, then edges), placed by `handlePoint`; `CORNER_ANCHORS` is its corner half and `cornerPoint` is deprecated in favor of `handlePoint`. Behavior change: `fixedCornerOf` now pins the center on a `'free'` anchor axis instead of the bounds origin, which only differs when a constraint resizes that axis.
