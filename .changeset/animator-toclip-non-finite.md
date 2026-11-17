---
'@weasel-js/animator': patch
---

`toClip` throws, naming where, on a time, `duration`, `at`, weight or bezier point that is not finite, rather than writing a clip `bindClip` refuses once it has been through JSON.

<!-- entry: fix -->
