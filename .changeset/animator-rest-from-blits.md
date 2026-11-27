---
'@weasel-js/animator': patch
---

A spring or a coast ends when blits says its voices have landed, under the same `restThreshold`. A coast stops at the point where it slowed under it.

A spring on a target that runs as two voices, a move and a push or a `from` away from the committed value, now ends once each has settled within `restThreshold` rather than once their sum has, which can be a few frames apart.

<!-- entry: rank=-5 behavior -->
