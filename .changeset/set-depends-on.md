---
"@weasel-js/core": patch
---

`scene.setDependsOn(id, dependsOn)` retargets a node's dependencies as one
undoable step, so dragging an existing edge's end onto a different node no
longer means removing the edge and adding another one. Switching a container
between an id list and `'children'` goes through the same call.

Both indices move with it — the reverse dependents index that drives cascade
delete, and the `'children'` set that drives the ancestor walk — and the
retargeted node's own memo is dropped alongside its dependents', since its
derivation now reads different sources. Order is significant, because a
derivation reads its dependencies positionally; declaring what a node already
declares records no history entry.
