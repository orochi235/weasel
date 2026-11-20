---
'@weasel-js/loupe': patch
---

An eyedropper whose latest hover's read fails settles `color` on `null`, not the previous point's color.

`onColorChange` reports the `null`.

<!-- entry: fix -->
