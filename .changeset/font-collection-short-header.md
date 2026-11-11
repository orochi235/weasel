---
'@weasel-js/font': patch
---

A font collection cut off inside its header, or one whose member count runs its member offsets past the end of the file, is refused with a "font collection is truncated" error instead of an out-of-range `RangeError`.
