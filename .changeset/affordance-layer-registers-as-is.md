---
'@weasel-js/core': patch
---

A `composeAffordanceLayer` layer goes to `registerLayer` or a `layers` slot without a cast.

It is typed `RenderLayer<unknown>`, the data it already accepted.

<!-- entry: fix -->
