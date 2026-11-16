---
'@weasel-js/core': minor
---

`registerPaintStandIn` lets an overlay stand in for part of a node's paint: the canvas leaves out what the overlay draws.

`registerPaintStandIn(scene, within, keep)` returns a stand-in; while it `show(id)`s a node, every canvas of `scene` inside `within` paints that node through `keep(cmds)`. A text editor's overlay uses it to leave the edited glyphs out.

<!-- entry: new api -->
