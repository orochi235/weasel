---
'@weasel-js/d3': patch
---

A transition with nothing to tween on a node still lasts its duration there, as in d3, so a transition chained after it waits for it.

<!-- entry: fix -->
