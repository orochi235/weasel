---
'@weasel-js/ui': patch
---

A `SelectionPanel` section drawn `as: 'bar'` marks the cell it fuses from a run of paired flags when `selected` names any flag in the run. It used to mark the cell only for the run's first flag, so a later one marked nothing. A flag a renderer draws is a cell of its own, and is marked as one.
