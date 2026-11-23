---
'@weasel-js/core': patch
---

Dropping a streamed cell keeps any of its nodes holding an edited or document node, rather than removing that node outside undo.

<!-- entry: fix -->
