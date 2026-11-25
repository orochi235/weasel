---
'@weasel-js/history': patch
---

An undo or redo that throws partway through a coalesced entry whose ops share a `coalesceKey` leaves every op's target where the step began.

<!-- entry: fix -->
