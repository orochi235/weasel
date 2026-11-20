---
'@weasel-js/paint': patch
---

`solid`, `solidFill`, `solidStroke` and `paintWithColor` move the alpha of an `rgba()`, `hsl(… / a)` or other non-hex color to `opacity`, so it is no longer applied twice.

<!-- entry: fix visual -->
