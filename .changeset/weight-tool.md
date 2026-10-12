---
'@weasel-js/core': patch
---

Adds API: `useWeightTool({ scene, rig })`, a tool that paints bone weights on the canvas. It works on every path under the rig node and writes each one's `data.skin`. A click on a joint makes it the active one. A drag is a round brush: points under it follow the active joint more, the nearer the brush's center, and their other joints give way so each point still sums to 1. With Alt held they follow it less. A click away from any joint is one dab. Every point, curve handles included, shows as a dot colored by the active joint's share of it, with the skeleton drawn over them. A stroke is one undo entry. Its key is W; mount it with `tools={{ weight }}`, and hand it the same `createRigEditState()` as the bone tool so both act on one joint.

`setWeights(skin, count, joint, weights)` and `brushWeights(coords, x, y, radius, current, mode)` are the pure edits behind it.

The rig in view is bound from the document, so a stroke bends the path when it ends, not while it is painted.
