---
'@weasel-js/d3': patch
---

A transition refused for a pose descriptor with no `lerp` changes nothing and is refused again when restarted, and one that tweens no pose runs without a `lerp`.

`.pose()` on such a transition throws where it is called.

<!-- entry: fix -->
