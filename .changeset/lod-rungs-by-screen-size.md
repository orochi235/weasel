---
'@weasel-js/core': minor
---

A node can draw differently by its size on screen, through rungs the render walk picks each frame, and a collapsed group skips its children.

A painter declares `ladder: { rungs: [{ id, fromPx, paint?, children? }], sizeOf? }`, coarse to fine; the render walk hands the chosen rung to `paint` as `ctx.rung`, moving up at 1.5× a threshold and down at 0.67×. Every node also has the built-in rungs `full`, `box` (its pose box, filled, in place of its children) and `none`. A node saves its own thresholds as `lod: [{ as: 'none', fromPx: 0 }, { as: 'full', fromPx: 40 }]`, written with `scene.setLod`. `layers={{ scene: { lod: { collapseBelowPx: 24 } } }}` draws every group smaller than that as its box, without visiting its subtree, and a click on that box picks the group. `createLodState`, `createLodWalk` and `rungIndexAt` are the parts, for a host that walks a scene itself.

<!-- entry: rank=10 new api data -->
