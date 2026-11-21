---
'@weasel-js/svg': patch
---

Importing a mesh gradient drops a patch whose color does not parse, with a warning. A patch with the wrong number of points or colors was already dropped that way.

<!-- entry: fix data -->
