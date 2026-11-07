---
'@weasel-js/stroke': patch
---

A stroke whose width is infinite or NaN tessellates to an empty mesh, as one of width zero does. It used to give a ribbon of non-finite vertices.
