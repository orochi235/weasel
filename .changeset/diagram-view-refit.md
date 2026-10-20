---
'@weasel-js/diagram': patch
---

`DiagramView` fits again when new specs run past what it shows, while the user has not panned or zoomed it, and `fit()` on the ref fits it on demand, even after they have.
