---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

A Smudge brush: a round brush that pushes the outline of the selected paths along with the pointer. Points under the brush move with it, most at its center and not at all at its rim, and a segment the brush meets that is longer than a third of its radius is subdivided until it can bend there.

`@weasel-js/geom` adds `smudgePath(path, opts)`, one dab of the brush.

`@weasel-js/core` adds the `smudgeBrush` action to the `paths` preset and `useSmudgeBrushTool` (key S), whose drag routes to it. The action's `radiusPx` (screen px) and `strength` params are set with `<SceneCanvas tune>` and read on every move, its cursor is the Simplify brush's ring at that radius, and a stroke is one undo step.
