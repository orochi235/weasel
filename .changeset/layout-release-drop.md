---
'@weasel-js/core': patch
---

A layout strategy decides what happens to a child released outside every
container.

When no container accepted a drag, the move action committed the child wherever
the pointer stopped, and the source layout had no say — a grid could not close
the gap, and a container that only means to arrange its own children could not
take one back.

`LayoutStrategy.releaseDrop` is that say. It sees the source container, its
remaining children and the dragged child in world coordinates, and returns ops
that replace the free-space commit. An empty array leaves the container alone,
which snaps the child home, since the drag only ever wrote previews. `null` —
and a strategy that does not implement the method — leaves the drop where the
pointer left it, exactly as before.
