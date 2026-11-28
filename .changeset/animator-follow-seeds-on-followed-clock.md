---
'@weasel-js/animator': patch
---

A hosted animator driven by `follow` starts an animation from idle where the followed clock stands, rather than playing it backward.

The first frame after switching between `tick` and `follow` moves nothing.

<!-- entry: fix -->
