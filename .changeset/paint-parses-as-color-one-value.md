---
'@weasel-js/paint': patch
---

Without `CSS.supports`, `parsesAsColor` refuses a value that only starts with a color function, such as a shadow.

<!-- entry: fix -->
