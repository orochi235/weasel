---
'@weasel-js/diagram': patch
---

A sequence diagram with any locked part takes no edit: its parts stop taking presses, and `commitSequence` leaves it as it stands rather than throwing.

<!-- entry: fix -->
