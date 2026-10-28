---
'@weasel-js/ui': patch
'@weasel-js/diagram': patch
---

`ToolPalette` takes `carryGhost(tool)`: what follows the pointer, centered on it, while a tool `carryTool` carries is on the move. `DragGhost` takes `centered`, which makes `at` its center, and `bare`, which draws its children with no surface under them. `@weasel-js/diagram` exports `StencilGhost`, a stencil's outline as an SVG at the size a click places it, in a node style and at a zoom, for a palette to carry. This adds API.
