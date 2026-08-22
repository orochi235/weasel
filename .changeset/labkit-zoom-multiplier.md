---
'@weasel-js/labkit': patch
---

Zoom past 2x reads as a multiplier

The workspace toolbar and status bar showed zoom as a percentage at every
scale, so a lab zoomed deep into its geometry read `1600%`. Above 2x they now
show `16x` instead; at 2x and below the percentage is unchanged.

Both surfaces went through the same `Math.round(zoom * 100)` expression
written twice. They now share `formatZoom`, alongside the other display
helpers in `ui/format`.
