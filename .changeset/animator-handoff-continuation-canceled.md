---
'@weasel-js/animator': patch
---

A compositor run taken back to the main thread leaves the animator whenever what carries it on there is canceled or retired for a throw, rather than staying active and refusing later handoffs on its target.

<!-- entry: fix -->
