---
'@weasel-js/ui': patch
---

`PatternPicker` commits only the latest pick, dropping an image still being read when another pick replaces it.

The same holds when the picker unmounts during the read.

<!-- entry: fix -->
