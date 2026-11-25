---
'@weasel-js/history': patch
---

An undo or redo that throws partway through a committed journal's entry leaves the state where the step began, even when an op after a coalesced run writes the same field the run does.

<!-- entry: fix -->
