---
'@weasel-js/core': patch
'@weasel-js/routing': patch
'@weasel-js/diagram': patch
'@weasel-js/path-tools': patch
'@weasel-js/kernel3d': patch
---

Fixes from an audit of core's canvas, tools and input:

- A paste that lands in a container or on a page puts the members of a pasted envelope group where they were drawn; they were stored in world coordinates under the container's frame and landed offset by it.
- An Alt-drag clone snaps to its own source, which stays where it was. `SnapBegin` takes `exclude`, the nodes that offer no targets, which defaults to `ids`.
- A Shift-drag on empty canvas marquees and adds what it takes to the selection; the select tool's marquee forbade Shift, so it did nothing.
- A drag started with a modifier already held now starts: every shape tool (rect, ellipse, line, polygon, star, text, sticky, image, pencil, diagram stencils) with Shift, Alt or Ctrl; move, resize, rotate, clone and measure with Shift or Ctrl; anchor and handle drags, the anchor marquee, balance grips and diagram waypoints with the keys their roles read. Their bindings left those keys out, which the matcher reads as forbidden. `roleMods(roles)` builds a binding's `mods` from an action's modifier roles, and `INSERT_DRAG_MODS` is the insert drag's.
