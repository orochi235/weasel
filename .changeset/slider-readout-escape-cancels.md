---
'@weasel-js/ui': patch
---

A slider's editable readout committed the typed text on Escape, and called `onChange` twice on Enter. Escape now leaves the value alone, and Enter writes it once.
