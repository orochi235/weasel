---
'@weasel-js/ui': patch
---

An inline property row holding a select lines its value up with its label under `align="center"` too. Text rows already aligned on the baseline, but `center` overrode that, and centering a 9px label against an 11px value left the value about 1px low. For those rows `center` now means `baseline`; `start` and `end` still apply as given.
