---
'@weasel-js/svg': minor
---

`svgNodesFromKit` writes a node a painter of your own draws (`registerNodeShape`) from the commands that painter returns, with no `leaf`.

Its path commands keep their fill, stroke and gradients, and its group commands their transform, opacity and clip, inside a `<g>` carrying the pose's rotation and `transform`. Text, image and shader commands are left out, each kind said once to the new `onWarn` option, or with `console.warn` without one. `leaf` still wins where it returns a node.

<!-- entry: rank=5 new api data -->
