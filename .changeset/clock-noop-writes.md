---
'@weasel-js/clock': patch
---

A clock neither wakes its frame loop nor notifies its subscribers for a `rate`, `loop` or `seek` that leaves it where it stands.

A write of the rate it plays at still replaces a running ramp.

<!-- entry: fix -->
