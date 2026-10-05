---
'@weasel-js/core': patch
---

A batch flush sends `u_samplers`, `u_fieldScale` and `u_synthBold` only when
they change, and no longer unbinds its vertex array after every draw; the
renderer unbinds before a draw that sets up its own attributes and at the end
of the frame instead.
