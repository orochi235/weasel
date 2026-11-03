---
'@weasel-js/minimap': patch
---

A wheel over `<MinimapCanvas>` now zooms the main view about the world point under the cursor, which keeps its place in the main view; a trackpad pinch does the same. The zoom is clamped to the kit's default limits, or to the `{ min, max }` passed as the new `wheelZoom` prop, and `wheelZoom={false}` turns it off. The action behind it is exported as `minimapZoomAction` (`minimap.zoom`). This is new default behavior: a consumer that relied on the wheel scrolling the page over the minimap needs `wheelZoom={false}`.
