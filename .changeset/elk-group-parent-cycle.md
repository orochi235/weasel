---
'@weasel-js/diagram-elk': patch
---

`elkPlan` lays out a group whose parents lead back to itself at the top level, with everything it holds. Such groups were never reached from ELK's root, so ELK rejected any edge to a node inside one ("Referenced shape does not exist").
