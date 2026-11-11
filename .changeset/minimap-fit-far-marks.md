---
"@weasel-js/minimap": patch
---

The minimap's `"scene"` and `"live"` fits now frame a mark far out on both axes. A mark was dropped from
the fit when its coordinates and size summed past the double range, though each was finite, so a lone
mark at (-1.8e308, -1e308) left the minimap on its fallback view at the origin.
