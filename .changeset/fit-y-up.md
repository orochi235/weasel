---
'@weasel-js/core': patch
---

Fitting the view to content keeps a y-up camera y-up. `fitViewToBounds`, which zoom-to-fit, `fitViewToPage` and the view animation's fit use, returned a positive scale on every axis, so fitting a view with a negative `scale.y` turned the canvas upside down.
