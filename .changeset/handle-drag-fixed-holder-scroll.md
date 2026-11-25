---
'@weasel-js/routing': patch
---

`useHandleDrag` follows a scroll of the transformed box that holds a `position: fixed` rect, so points reported during that scroll stay under the pointer.

<!-- entry: fix -->
