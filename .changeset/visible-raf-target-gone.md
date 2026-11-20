---
'@weasel-js/react': patch
---

A `useVisibleRaf` loop keeps running when its `target` leaves the document, and resumes once a commit points `target` on screen.

<!-- entry: fix -->
