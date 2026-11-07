---
'@weasel-js/clock': patch
---

A clock given `loop: NaN`, at creation, by `declare`, or by setting `loop`, had a run of NaN ms and reported NaN for `pass` and `phase`. It now throws a `RangeError`.
