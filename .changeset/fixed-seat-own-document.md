---
'@weasel-js/gestures': patch
---

`fixedSeat` seats an element from an iframe or another window in that element's own document: its host falls back to that document's body, and a transformed root there no longer has its scroll counted twice.

<!-- entry: fix -->
