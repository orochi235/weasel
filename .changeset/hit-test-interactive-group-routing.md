---
'@weasel-js/core': patch
---

`<SceneCanvas isPointerInteractive>` gates every point hit on the canvas, as its doc said: a node it rejects is left out of the select tool's pick, the dispatcher's `kind:` classification, the `hitAt` and `nodeAtPoint` deps, and the `onClick`/`onDoubleClick` observers, and whatever is beneath it answers instead. Before, only the observers honored it, and they reported a miss rather than the node beneath. Routing entries are now handed the node beside its data (`NodeRoutingEntry.matches(data, node)`, `NodeRouting.classify(data, node)`), and `inferredNodeRouting` and `defaultNodeRouting` lead with the new `groupNodeRouting`, which routes a container as `'group'` where it was `'unknown'`.
