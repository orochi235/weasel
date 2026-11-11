---
"@weasel-js/renderer": patch
---

A retained group being redrawn no longer composites pixels from a draw that never finished. After `reserve` hands its surface out, the surface matches no key until `commit` names the one its new pixels were drawn under.

<!-- entry: fix visual -->
