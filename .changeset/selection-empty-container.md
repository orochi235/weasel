---
'@weasel-js/core': patch
---

An empty container no longer draws selection chrome at its own stored pose

`composeSelectionPose` and the overlay's container-aware bounds resolver both
document that a container with no leaves resolves to `null`. Neither could
return it: the leaf walk pushed any childless node, so an empty container
pushed *itself*, and the `leaves.length === 0` guard was unreachable. The
container's own stored pose then became the overlay bounds — the one value
this resolver exists to avoid, and at its most stale when nothing is left
inside to have moved it.

A childless node now counts as a leaf only when it is not itself a container.
