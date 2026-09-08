---
'@weasel-js/core': patch
---

Dragging several selected nodes into a layout container now runs the layout,
instead of falling through to a plain translate. Three nodes dropped on a grid
fill three cells.

The selection lands as a unit. One container is chosen, from the center of the
whole dragged group rather than each child's own — hit-testing per child would
scatter a selection straddling two containers — and it has to accept every
member: `acceptsDrop` is asked once per dragged child, and one refusal takes the
container out of the running. The children are then placed one at a time, in
selection order, and each placement sees the container state the previous one
produced. A strategy that packs, stacks or displaces therefore sees the group
arrive the same way it would see three separate drags. If any child has no
target, the whole drop is refused rather than split between two homes.

Each child is snapped at its own position, displaced by however far the pointer
sits from the selection's center, so the group keeps its shape as it lands. A
single-node drag still probes at the pointer exactly as before.

The rest follows the selection: the live preview reflows the destination and
every source container the selection left, one pass per container with all of
its departing children withdrawn at once; and the commit emits a reparent op per
child that changed parent, every reparent before every drop.

`releaseDrop` — a container's say over its own child released into open space —
is now per source container too, so a mixed selection resolves per child: the
grid's own child goes home, and a free node in the same selection keeps the
translate it would have had on its own.
