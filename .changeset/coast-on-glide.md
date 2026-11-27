---
'@weasel-js/core': patch
---

A flung pan coasts and bounces along the same path at any frame rate, now that `useDecayLoop` runs on a blits `glide`.

A `'bounce'` or `'spring'` edge met partway through a frame turns the view back for the rest of that frame instead of holding it on the edge, a long frame is no longer cut to 64 ms, and the frame the speed drops below `minSpeed` still moves the view before the coast ends.

<!-- entry: behavior -->
