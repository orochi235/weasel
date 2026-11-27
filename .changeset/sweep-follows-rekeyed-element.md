---
'@weasel-js/routing': patch
---

A sweep enters a new item when the element under the pointer is reused for it under another key, as a virtualized grid recycles its cells. An object key built afresh by each `keyOf` call still counts as the same item while its element stays.

<!-- entry: fix -->
