---
'@weasel-js/svg': patch
---

Under `keepHidden`, a `<use>` of a `display="none"` element arrives as a hidden node, as the element itself does, instead of being left out.

<!-- entry: fix data -->
