---
'@weasel-js/core': patch
---

`onPoseWrite` reports a child removed with its parent and put back in the same change as moved, not added.

A child left out when only its parent is put back is reported removed from that parent.

<!-- entry: fix -->
