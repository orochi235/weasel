---
'@weasel-js/animator': patch
---

`cancelAll` and a hosted animator's `dispose` stop the frame loop and clear overrides even when a target's setter throws.

<!-- entry: fix -->
