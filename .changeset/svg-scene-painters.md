---
'@weasel-js/svg': minor
---

`svgNodesFromKit` and region exports write a node with the painters of the scene it belongs to, including those a canvas's presets installed.

`svgNodesFromKit` reads `nodeShapesOf(tree)` by default; its new `shapes` option names another registry.

<!-- entry: new api -->
