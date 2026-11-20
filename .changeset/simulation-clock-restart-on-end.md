---
'@weasel-js/simulation': patch
---

A simulation on a clock keeps running when its `onEnd` calls `restart()`, as one on its own frame loop does.

<!-- entry: fix -->
