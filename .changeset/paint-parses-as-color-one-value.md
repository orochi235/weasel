---
'@weasel-js/paint': patch
---

`parsesAsColor` no longer reads a value that only starts with a color function, such as a shadow `rgb(0 0 0) 0 2px rgb(1 1 1)`, as a color where there is no `CSS.supports`.

<!-- entry: fix -->
