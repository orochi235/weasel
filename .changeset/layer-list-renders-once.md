---
'@weasel-js/ui': patch
---

`LayerList` rendered every level twice for each update, including each pointer move of a drag, because its container ref was rebuilt on every render. It now renders once.
