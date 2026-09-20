---
'@weasel-js/core': patch
---

`resolveDerivedPath` now notices a dependency that moved on its own. On a memo hit it re-resolves the dependencies and compares their poses **by value** against the ones the cached path was drawn from, rather than serving the cached path until the scene pushes an invalidation. That covers the three misses the pushed triggers have had to be widened for — an ancestor's frame moving, a dependency going away, a dependency appearing — and covers a lookup the scene cannot know about at all, such as the `toPose` a scene slot paints through. By value, not by reference: a pose override mutates its buffer in place.

The pull covers poses. A derivation is handed each dependency's whole node, so one reading `data` or `layer` still rides on the scene's pushed invalidation, which is unchanged.

It costs a resolve and a compare per dependency per frame. Measured with `tests/perf/bench/derived-path.bench.ts` on one machine, taking the minimum of 200 iterations, a steady-state frame in which nothing moved went from 0.0037ms to 0.0112ms at 30 edges, 0.0212ms to 0.0590ms at 150, and 0.0863ms to 0.2757ms at 750 — about 3x the memo-hit frame, and under 2% of a 16.7ms frame at the largest of those. Two changes keep it there: `samePoseValue` walks an opaque pose without allocating, and a dependency now reaches a derivation as a class instance rather than an object literal with an own `get path()`, which alone was a third of the added cost.
