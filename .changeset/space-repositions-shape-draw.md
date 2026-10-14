---
'@weasel-js/core': patch
'@weasel-js/routing': patch
---

Hold Space while drawing a rectangle, ellipse, line, polygon, or star to move the shape instead of resizing it; let go and the drag resizes again from where the shape now sits. It is the `insert.reposition` action, which each kit shape tool binds through `INSERT_REPOSITION_BINDING` (a Space hold gated to the tool's own engaged phase), so a consumer's own drag-to-draw tool can bind it the same way. A grid-snapped start stays on the grid as it moves.

An offhand tool now engages only between gestures: `buildToolOffhandBindings` gates its key-held specs to `[{ channel: '*', phase: 'initial' }]`. Before, pressing Space mid-drag pushed the hand tool, and the tool switch canceled the drag.
