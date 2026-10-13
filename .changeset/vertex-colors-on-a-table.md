---
'@weasel-js/animator': patch
---

Animated vertex colors are rows of a target table. `animator.colorOverrides` keeps every node's colors of one length in one `createTargetTable`, so a frame of many nodes changing color fills them in one pass, and a painter's `resolve` copies a row where it read a target. With 10,000 nodes of four anchors tweening, a frame and its resolves took 825 ns a node and takes 374 (`node tests/perf/target-reads/run.mjs colors 10000`, plain Node on one machine).

`createTargetTable` takes two callbacks: `set(row)`, called after a row is committed, and `show()`, called once a frame after the animator fills `shown`.

Two things behave differently. A target from `colorOverrides.target` that was released or cleared while resting now throws when it is read or committed, where it used to come back into the registry; ask the registry again, as its docs already said to. The same holds for `table.target(row)` after `table.remove(row)`, which used to write into whichever row took the index next.
