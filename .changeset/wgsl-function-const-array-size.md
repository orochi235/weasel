---
'@weasel-js/renderer': patch
---

A WGSL program's uniform array is sized by the module-scope const it names, not by a function's local const of the same name.

<!-- entry: fix -->
