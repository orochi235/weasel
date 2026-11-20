---
'@weasel-js/routing': patch
---

Adjusting the last operation reruns the action only where `trigger` would run it. An `eligible` rule that bars it now, or a run that returns `'pass'`, leaves the operation as it was.

<!-- entry: fix -->
