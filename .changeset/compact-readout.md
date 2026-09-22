---
'@weasel-js/ui': patch
---

`formatCompact` shows three significant figures above a thousand — `40.0K`, `294K`, `2.00M` — instead of one fixed decimal, so a slider's compact readout holds one width whatever the value; `294.0K` no longer fits where `40.0K` did.
