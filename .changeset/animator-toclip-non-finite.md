---
'@weasel-js/animator': patch
---

`toClip` throws, naming where, on a time, `duration`, `at`, weight or bezier point that is not finite, which JSON would write as `null`.

<!-- entry: fix -->
