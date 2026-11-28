---
'@weasel-js/animator': patch
---

`toClip` refuses a key value or event data that contains itself with an error naming the track, rather than overflowing the stack.

<!-- entry: fix -->
