---
'@weasel-js/clock': patch
---

`holdPosition` at a position recorded from an ended run lands on the shown time it recorded, at the end of the last pass, as `declare` does.

That holds for a position recorded under another `duration` or `origin`.

<!-- entry: fix -->
