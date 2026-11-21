---
'@weasel-js/core': patch
---

`useDragHandle`'s default ghost no longer copies its source's `id` attributes, so a drag never puts a duplicate id in the document.

<!-- entry: fix -->
