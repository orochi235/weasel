---
"@weasel-js/core": patch
"@weasel-js/d3": patch
---

`Scene.incarnation(id)` returns a token for the node an id names right now. It
holds through every edit to that node and changes whenever the id enters the
scene again — a fresh `add`, an undo or redo that brings it back, or
`loadState` — so something holding an id across frames can tell whether it
still names the same node.

`@weasel-js/d3` transitions use it: a node removed and re-added under the same
id between two frames is now treated like a removed node. Its transition stops
for that node, the node taking the id is left alone, and a `.remove()` no longer
deletes it.
