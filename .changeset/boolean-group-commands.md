---
'@weasel-js/core': patch
---

Boolean groups can be made, switched and released from the kit's commands. Make Boolean Group (`pathfinder.booleanGroup`, in the `paths` preset and the Pathfinder group) puts the selection under a new union in the frontmost node's place, wearing that node's fill and stroke, and nothing moves on screen; `makeBooleanGroup(scene, ids, op?)` does the same from code. Ungroup now releases a boolean group too, its children taking its place. A boolean group routes as `'boolean'` (`booleanGroupRouting`, now in `inferredNodeRouting`), and its properties carry an Operation control over `data.boolean`. A routing entry's `node` may now carry `consumesChildren`. This adds API.
