---
'@weasel-js/core': patch
---

Pressing an arrow key with a group selected recorded a `Nudge` undo entry and moved nothing: only the container's own pose was written, and with the default absolute poses its children each store their own position. The `nudge.*` actions now move the descendants of a selected node too, and move a child once when it is selected along with its container.
