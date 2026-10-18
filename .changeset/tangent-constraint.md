---
'@weasel-js/geom': patch
'@weasel-js/path-tools': patch
---

A `tangent` path constraint keeps an anchor's two handles on one line through it, pointing apart — G1 continuity — with their lengths free. Additive.

The solver now works over handles as well as anchors: each handle is an offset from its anchor, so it rides with the anchor as before, and becomes a variable only where a `tangent` reads it. `ConstraintPoint` carries `inHandle` and `outHandle`, `pathAnchorPoints` reports them, `solvePathConstraints` writes the turned handles back, and `solveConstraints` takes `heldHandles` beside `held`. `constrainPathEdit` holds the handles an edit moved, so a handle drag finished through it turns the other handle and leaves the dragged one where the pointer put it. A tangent on an anchor missing a handle cannot hold and is reported as unsatisfied; one the solve could satisfy only by shrinking a handle to nothing is a conflict. `constraintApplies` says whether a constraint can be solved over a set of points.

In `@weasel-js/path-tools`, `constrainAnchors` with kind `tangent` constrains each selected anchor that has both handles, and the overlay marks a tangent anchor with a line touching a circle.
