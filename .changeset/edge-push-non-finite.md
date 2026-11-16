---
'@weasel-js/ui-input': patch
---

`edgePush` and `edgeScroll` answer no push for a pointer at `NaN`, and a full push past an end under an infinite margin, instead of `NaN`.

<!-- entry: fix -->
