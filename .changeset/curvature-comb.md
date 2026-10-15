---
'@weasel-js/geom': patch
'@weasel-js/core': patch
---

Path edit can show a curvature comb: teeth standing out of each curved segment along its normal, each as long as the curvature where it stands, with a line through their tips. It draws from the same in-flight path as the anchors, so it follows anchor and handle drags. It shows while chrome-caps shows the new `path-edit.comb` id, which is off by default; `editingAnchors`, now exported, is the usual rule to turn it on with. Its scale, teeth per segment, and color come from the `<SceneCanvas>` layer slot `layers.pathEditingOverlay`, which also takes the overlay's `style`. A `null` or a layer of your own in that slot now replaces the overlay, as it does for `selectionOverlay`.

`@weasel-js/geom` adds the geometry underneath: `cubicCurvatureAt`, `cubicDerivativeAt`, and `curvatureComb` over an anchor set. `combTeeth` stands a comb on any `CurvatureSource`, a curve read as point, tangent, and curvature over t; `cubicCurvatureSource` makes one from a cubic, and `curvatureSourceOf` in `@weasel-js/geom/curves` makes one from any curve representation. The cubic and Spiro representations' `curvatureAt` now read `cubicCurvatureAt`.
