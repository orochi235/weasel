---
"@weasel-js/guides": patch
---

Equal-spacing snapping measures a box's gap to every box tied for nearest on its right, so its marks no longer depend on sibling order. `measureGaps` measures each one, such as two boxes stacked in one column beside the box.

<!-- entry: fix visual -->
