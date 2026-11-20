---
'@weasel-js/history': patch
---

A `goto` that throws and cannot walk back to where it began reports a `'goto'` step to `observe` listing every op it applied, so a listener mirroring the history through `applied` stays in step.

<!-- entry: fix -->
