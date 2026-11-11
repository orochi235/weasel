---
"@weasel-js/svg": patch
---

`serializeSvg` no longer fades a shape that inherits its fill or stroke from a group when a group further out set an opacity for that paint. A group writing its own fill or stroke now states every attribute of it that a group above set, `fill-opacity="1"` included, so the outer group's opacity no longer leaks past it. Scenes exported with `svgNodesFromKit` whose nested containers carried paints with different opacities were affected.
