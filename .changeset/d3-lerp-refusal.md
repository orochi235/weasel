---
'@weasel-js/d3': patch
---

A transition refused for a pose descriptor with no `lerp` changes nothing, and one that tweens no pose runs without a `lerp`.

It is refused again when restarted.

`.pose()` on such a transition throws where it is called.

<!-- entry: fix -->
