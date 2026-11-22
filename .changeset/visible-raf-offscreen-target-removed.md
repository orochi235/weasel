---
'@weasel-js/react': patch
---

A `useVisibleRaf` loop held while its `target` is out of view resumes once that element leaves the document, with no host render needed.

<!-- entry: fix -->
