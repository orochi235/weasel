---
'@weasel-js/registry': patch
---

`isOneChar` reads a lone surrogate, half of an emoji, as no character, so a list or menu no longer types one.

<!-- entry: fix -->
