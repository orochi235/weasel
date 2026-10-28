---
"@weasel-js/core": patch
---

Scene edits no longer climb a node's ancestors to check for a lock while nothing in the scene is locked, and the climb they do make when something is allocates nothing. Since per-node locks landed, every edit built a fresh pair of gate maps and walked to the root: `setPose` on a node 16 deep took about 2.5 µs, and now takes about 0.5 µs. `isNodeLocked` and `isNodeHidden` take the same allocation-free path.
