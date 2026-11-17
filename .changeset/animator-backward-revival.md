---
'@weasel-js/animator': patch
---

A finished timeline set to play backward is revived by a seek away from its start, and a seek to 0 leaves one that finished backward finished, with no second `onDone`.

<!-- entry: fix -->
