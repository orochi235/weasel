---
'@weasel-js/paint': patch
---

`solid` and `paintWithColor` move an `rgba()` or `hsl(… / a)` color's alpha to `opacity`, so it is not applied twice.

`solidFill` and `solidStroke` do the same.

<!-- entry: fix visual -->
