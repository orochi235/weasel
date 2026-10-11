---
'@weasel-js/core': patch
---

A node added with `pickable: false` that was deleted and restored by undo through a move or rotate commit came back taking clicks. The restore now keeps the flag.
