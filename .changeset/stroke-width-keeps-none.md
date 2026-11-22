---
'@weasel-js/editing': patch
---

Setting the stroke width on a shape whose stroke is set to None keeps it None, rather than giving it a stroke in the default color.

<!-- entry: fix -->
