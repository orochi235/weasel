---
'@weasel-js/animator': patch
---

A hosted animator driven by `follow` starts an animation from idle where the followed clock stands, rather than playing it backward over the gap to the host's `now`; the first frame after switching between `tick` and `follow` moves nothing.

<!-- entry: fix -->
