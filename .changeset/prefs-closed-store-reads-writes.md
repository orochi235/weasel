---
'@weasel-js/prefs': patch
---

A closed prefs store reads back a write made after `close`, as `closed` documents, instead of the values it held when it closed.

<!-- entry: fix -->
