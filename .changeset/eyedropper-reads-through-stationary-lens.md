---
'@weasel-js/loupe': minor
---

An eyedropper given a loupe reads what a stationary lens magnifies when the pointer is over the lens, rather than the lens' own pixels.

A point whose magnified source lies under the lens itself reads as nothing. The loupe model's new `sourceAt(p)` answers which surface point the presented pixel at `p` shows, for anything else that samples a surface carrying a stationary lens.

<!-- entry: fix api -->
