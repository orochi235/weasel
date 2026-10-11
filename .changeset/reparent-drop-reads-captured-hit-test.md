---
'@weasel-js/core': patch
---

`moveAction` read the `nodeAtPoint` dep for `reparentOnDrop` from the context its `onEnd` was handed, and the dispatcher ends a gesture with an empty deps bag, so a drag released over a container was translated and never reparented. The action now captures the dep when the gesture starts. A drag committed with no pointer in its end context (a second finger lifting on touch) is hit-tested at the last pointer position the drag saw.
