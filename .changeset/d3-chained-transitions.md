---
'@weasel-js/d3': patch
---

Transitions chain: `.transition().duration(500).transition().pose(fn)` runs the second on each item as soon as the first finishes that item, so a staggered chain stays staggered. A chained transition keeps the name and inherits the duration and ease of the one before it unless you override them; its `.delay()` counts from when that item's previous transition ended. Starting any transition in a chain starts all of it, and interrupting one interrupts everything chained after it. Transitions also take `.pose(fn)` for a per-item target pose, which is how a chained transition moves nodes; on the first transition it overrides the pose `.join()` set.
