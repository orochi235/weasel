---
'@weasel-js/ui': patch
'@weasel-js/kernel3d': patch
'@weasel-js/labkit': patch
---

Add `ui:cube`, the d6's cube drawn at the weight of the set's other glyphs, for a toolbar: a box tool, say.

kernel3d's orbit tool sits in the `view` palette group with core's hand tool, so a palette orders it among the
navigation tools rather than after the ones that make things.

labkit's 3D lab picks its tools from a `ToolPalette`, through routing's `useTools`, with select active from the start.
