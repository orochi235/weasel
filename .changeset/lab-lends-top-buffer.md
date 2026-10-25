---
"@weasel-js/labkit": patch
---

A `<Lab>` nested under a surface owner that publishes only `over` and `under` now makes its own `top`
buffer on that owner's container, so its lenses paint. Before, `useSurfaceCanvas('top')` stayed null
there for good. The dev warning now fires only for a tenant outside any lab.
