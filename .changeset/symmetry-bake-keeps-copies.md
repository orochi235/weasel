---
'@weasel-js/symmetry': patch
---

Baking a symmetry group keeps each copied container's own `copiesFromPose`, so a container that draws copies of its contents still does in every baked copy.

<!-- entry: fix -->
