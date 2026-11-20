---
'@weasel-js/minimap': minor
---

`<MinimapCanvas>` leaves the layers its `layerVisibility` hides, or its `layerOrder` leaves out, out of its fit, so it frames only what it paints.

`computeFitView` takes the same map as its `layers` option.

<!-- entry: fix visual api -->
