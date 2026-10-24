---
'@weasel-js/core': patch
---

`kit:shape` paints a container that has a `shape` again, and its interior is grabbable by its fill. The previous release stopped it, so a node that draws itself and has children, such as a skeleton bone with child bones, drew nothing. A container whose `path` is its clip, as an SVG `<g>` imports, still paints nothing of its own.
