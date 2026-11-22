---
'@weasel-js/labkit': patch
---

`setMeta` on a mark from an older save writes it back in the current form, its vertices following its bounds, as `update` already does.

<!-- entry: fix data -->
