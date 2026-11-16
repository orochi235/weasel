---
'@weasel-js/ui-canvas': patch
---

`SelectionPanel` warns in development about a schema field it draws but can never save.

That is a field keyed outside `pose.`, `data.` or a declared field such as `clip`; it warns once per kind and path.

<!-- entry: fix -->
