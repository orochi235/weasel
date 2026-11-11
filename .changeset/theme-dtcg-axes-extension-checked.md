---
'@weasel-js/theme': patch
---

`loadDTCG` refuses a `com.weasel.axes` extension it cannot read with an error naming the part at fault, rather than a `TypeError`.

That is an axis without a string `default` and an object of `values`, a `varies` entry that is not a list of axis names, or an override layer that is not an object.

<!-- entry: fix -->
