---
"@weasel-js/core": patch
"@weasel-js/guides": patch
---

A grown `tileGrid({ overflow: 'grow' })` shrinks back when children leave it. Deleting a child, or moving or dragging one out, gives back each line of cells that empties — never below the declared `rows` (or `cols` for `flow: 'column'`) — and the rest keep their cell size instead of stretching over the grown container. The shrink lands in the same undo step as the departure.

This rides on a new optional `LayoutStrategy.depart(container, children, departed)`: the scene's layout pass hands it the children that stay and the ids that left, and it returns poses plus optional new container bounds, as `arrive` does. An edit that both removes and adds children runs `depart` first, then `arrive`. `SceneArrivalHandler` gains a third argument, `departures`, the nodes each container lost in the edit; `layoutArrivalHandler` and `useLayoutArrivals` pass it through. Additive: a strategy without `depart` is rearranged by `childPoses`, as before.
