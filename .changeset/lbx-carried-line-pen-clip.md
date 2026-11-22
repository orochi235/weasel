---
'@weasel-js/p-touch': patch
---

`writeLbx` skips a carried line whose pen reaches past the rect clip around it, rather than write ink outside the clip.

<!-- entry: fix -->
