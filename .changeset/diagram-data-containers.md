---
"@weasel-js/diagram": patch
---

`DiagramData` takes containers and pools. `containers` lists regions by id, each a container with
`members` or a pool with `lanes`; `diagramScene` builds each as a scene container holding its
members, outer regions first. A container with a `box` is laid out as one node of that size and its
members ride along with it, a member with no `at` seeded inside it in rows; one with no `box` is laid
out as a group and fits its members. A pool always has a box, and its lanes stack at their `size` or
share what the box leaves. An edge with an end inside a boxed region ranks against the outermost one.
Under `theme`, regions take the theme's container and lane colors, or a `style` role's.

`DiagramView` takes `onEditContainer`, which reports a region moved or resized (`box`), a lane
boundary dragged, a lane reordered by its header, or a lane added (`lanes`), a header
double-clicked (`title`), and Release members (`release`), keeping none of them until the specs
follow. `NodeMove` carries `parent` when a drop changed the region a node is in, `onDelete` reports a
deleted region with everything inside it, and the view lets shapes drop only into containers and
lanes. `router="avoid"` routes around regions and their headers as the scene router does, and
`diagramLayoutOf` also returns the boxes layout gave containers and pools.

`regionSpecs` and `firstLanes` are exported, so stencils and data build regions one way, and
`editContainerTitleAction` reports a double-click on a header. The data types moved to their own
module; every import path is unchanged.
