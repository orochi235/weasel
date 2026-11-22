---
'@weasel-js/editing': patch
---

Changing fill or stroke opacity on a shape whose fill or stroke is set to None leaves it None, rather than painting it in the default color.

<!-- entry: fix -->
