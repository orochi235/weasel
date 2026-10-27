---
'@weasel-js/core': patch
---

Boolean groups: a mark whose shape is the union, intersection, subtraction or exclusion of its children's outlines, recomputed whenever a child moves, changes or is hidden, while the children stay nodes. Add one with `scene.add({ ...booleanGroupFields(), layer, pose, data: { boolean: 'subtract', fill } })` and add its children under it. It paints the result in its own `data.fill` and `data.stroke`, is picked by that ink, moves its children when moved, and saves and loads like any derived node (`BOOLEAN_OF_CHILDREN`, `booleanOfChildren`, `booleanOpOf`). This adds API.

It is built on a new node field, `consumesChildren`: the render walk paints none of such a node's children, and a press, region select or select-all reaches one only while that node, or a group inside it, is entered. A node that consumes its children is entered as a group is. `createEnteredGroupScope` and `reachableInGroup` now read the scene's `get` as well as `ancestorsOf`.

Hiding or showing a node now recomputes whatever derives from it.
