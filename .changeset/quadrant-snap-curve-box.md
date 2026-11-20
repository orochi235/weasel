---
'@weasel-js/geom': patch
---

Quadrant snap points sit on the lines through the center of the box a closed curve reaches, rather than the box of its control points, so a teardrop or a dome gets them where its outline is.

<!-- entry: fix -->
