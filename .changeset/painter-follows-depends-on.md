---
'@weasel-js/core': patch
---

A node painted from a derived path kept its `kit:derived` painter after `scene.setDependsOn(id, undefined)` detached it, so it painted nothing where its own `data.path` should have shown; a static node that was then attached kept painting its static path. Undo and redo of the same op did the same. `findNodeShape` now re-matches when a node starts or stops deriving its path.
