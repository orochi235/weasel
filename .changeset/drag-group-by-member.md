---
"@weasel-js/core": patch
---

Pressing a node inside a selected group no longer selects that node on the press. A drag that starts
there moves the group, and a click that ends without a drag selects the node, as a press on one member
of a multi-selection already did. It used to select the member on the press, so the drag moved the
member alone and left the rest of the group behind.

A group here is a container whose pose derives from its children (`dependsOn: 'children'` with a
`derivePose`), which is what the `group` action makes in a scene that composes poses by identity. A
selected container with a pose of its own, such as a diagram container, still lets a press pick the
member out of it.
