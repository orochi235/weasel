---
'@weasel-js/labkit': patch
---

A sidebar section added under a mounted lab no longer warns "Cannot update a component while rendering a different component".

labkit now takes windease `^2.4.0`, which registers a new pane from its layout effect instead of during render.

<!-- entry: fix -->
