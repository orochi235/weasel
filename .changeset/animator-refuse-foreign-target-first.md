---
'@weasel-js/animator': patch
---

A tween, spring, or hold refused for another animator's target now leaves that target and the call's `cancelKey` alone.

A target setter that throws as a tween or a spring starts no longer drops the offset a hold kept beside the committed value.

<!-- entry: fix -->
