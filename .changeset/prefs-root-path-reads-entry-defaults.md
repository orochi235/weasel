---
'@weasel-js/prefs-schema': patch
---

A condition that reads a field of a list or map entry by its full path (`phases.0.hold`) finds the item's default where the entry omits the field or holds nothing, as a condition reading the entry does.

<!-- entry: fix -->
