---
'@weasel-js/animator': patch
---

`cancelAll` and a hosted animator's `dispose` stop the frame loop and clear the overrides even when a target's setter throws as its animation commits.

<!-- entry: fix -->
