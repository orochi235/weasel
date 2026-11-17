---
'@weasel-js/routing': patch
---

The last-operation panel closes when another tool is picked, if the operation was a tool's drag.

A Cloth Warp, Plane Warp or Knead drag left its settings up after the user moved to another tool, where changing them still replayed that drag. An operation a command made still stays until something else reaches the history. Holding a tool on its hotkey does not count as picking another.

<!-- entry: fix -->
