---
'@weasel-js/prefs-editor': patch
---

`PrefConditionEditor`'s `exclude` leaves out the field of the entry a path through it names (`phases.*.mode`).

The schema editor then no longer offers a field of a list or map entry a condition on its own value.

<!-- entry: fix -->
