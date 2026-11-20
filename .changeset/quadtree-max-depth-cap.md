---
'@weasel-js/guides': patch
---

`quadtree` quarters its container at most 7 times, rounding `maxDepth` down, so a deep or infinite `maxDepth` no longer hangs the page.

<!-- entry: fix -->
