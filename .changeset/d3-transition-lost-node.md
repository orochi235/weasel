---
'@weasel-js/d3': patch
---

A transition no longer throws when the scene loses a node it is tweening — an undo that takes back the node an enter transition created, or any outside `scene.remove`. On the next frame the transition stops that node, along with every transition chained after it, and the rest of the selection carries on; `end()` still resolves and `on('end')` still fires. An exit transition whose node was removed this way no longer deletes it at its end, so a node added again under the same id survives.
