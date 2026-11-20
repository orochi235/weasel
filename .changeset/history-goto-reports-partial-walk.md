---
'@weasel-js/history': patch
---

A `goto` that throws and cannot walk back reports its step to `observe`. The step lists every op both walks applied, so a listener mirroring the history through `applied` stays in step.

<!-- entry: fix -->
