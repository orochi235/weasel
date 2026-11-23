---
'@weasel-js/audio': patch
---

`inserts.add` throws for an effect already in another bus's insert chain, as it does for one already in the same chain.

<!-- entry: fix -->
