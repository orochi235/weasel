---
'@weasel-js/prefs': patch
---

`checkPrefConditions` checks a condition on a `union` field against every variant, not only the first.

`{ path: 'fill.d', is: '' }` no longer warns that it never holds when only another variant's `d` is a string.

<!-- entry: fix -->
