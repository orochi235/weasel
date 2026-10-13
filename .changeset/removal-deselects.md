---
'@weasel-js/core': patch
---

Removing a node takes it out of the scene's selection. `scene.getSelection()` used to keep the id of a node `scene.remove` had taken, so every reader guarded `scene.get(id)`. Undo puts the node and its selection back. `reconcileSpecs` carries the selection across a node it replaces by removing and re-adding the id, and deselects one it drops. `setSelection` still accepts an id no node has. This is a behavior change, made on an agent's judgment: a consumer that read a removed id back out of the selection no longer finds it.
