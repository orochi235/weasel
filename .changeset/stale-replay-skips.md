---
'@weasel-js/core': patch
---

Fixes: undo got stuck on an entry naming a node an untracked edit had removed. `scene.add(n)`, `scene.setPose(n, p)`, then `scene.untracked(() => scene.remove(n))`, which is what `reconcileSpecs` does when outside data drops a node, left `scene.undo()` throwing `unknown node id "n"` with the entry still on top, so nothing beneath it could be undone. A replayed op whose node is gone is now skipped, and the rest of its entry applies; so is one that would restore a node an untracked edit already added back under that id, which used to overwrite the live node. The inverse of a skipped op is skipped too, so undo then redo leaves the scene as it was. This covers the scene's own edits and ops applied through `scene.applyBatch` or `scene.history`. A first apply still throws on an unknown id. The skip rule was chosen on an agent's judgment over dropping the entries or clearing history.
