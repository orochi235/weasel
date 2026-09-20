---
'@weasel-js/core': patch
---

Project a `'polyline'` overlay's vertices to screen coordinates, the way
`useDispatcherOverlayLayer` already handles marquee, lasso and insert previews.
A cut line and a connector were wrapped in a `viewToMat3(view)` group instead,
so their stroke thickened with the zoom while the chrome beside them held its
CSS-pixel weight. That came across unchanged when the layer took over painting
from the actions; it is now the same rule for every overlay.
