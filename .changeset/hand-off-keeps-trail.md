---
'@weasel-js/routing': patch
---

A drag handed off with `'pass'` keeps its trail: the taker's `ctx.drag.points` starts at the press and holds every move before the hand-off, rather than restarting at the press. The action that passed keeps its own copy of the trail it had.
