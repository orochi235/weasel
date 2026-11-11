---
"@weasel-js/select": patch
---

`select` and `rangeOf` read ids as a `Set` does, so `NaN` is one id and `-0` is `0`. A toggle could turn a `NaN` id on and never off, a range could not start or end on one, and pressing a selection's lone `NaN` id handed back a new state rather than the same one.
