---
"@weasel-js/core": patch
"@weasel-js/paint": patch
"@weasel-js/labkit": patch
---

A `{ px }` marker size now holds its screen size through a zoom, as a `{ px }` stroke width does, and so does a default-sized marker under a `{ px }` stroke width. The line stops short of the head by the same resolved size, and a node's grab reach resolves it against the view scale.

The renderer now draws a stroke's markers itself, for any path command whose stroke carries one — so a painter only sets `markerStart` / `markerMid` / `markerEnd`. `markerDrawCommands` is no longer exported: a painter that appended its commands would now draw every head twice. labkit's annotation arrows rely on the renderer, and their SVG export keeps the marker reference so the head is drawn there too.
