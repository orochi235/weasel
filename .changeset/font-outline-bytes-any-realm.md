---
"@weasel-js/font": patch
---

`registerFontOutlines` reads an `ArrayBuffer` made in another realm, such as an iframe's, as bytes. It told bytes
from a blob with `instanceof ArrayBuffer`, so such a buffer failed to load as a blob with no `arrayBuffer` method.
