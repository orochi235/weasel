---
'@weasel-js/quantity': patch
---

`parseAs` and a quantity's `.parse()` read text holding a line break as NaN instead of throwing a `TypeError`.

<!-- entry: fix -->
