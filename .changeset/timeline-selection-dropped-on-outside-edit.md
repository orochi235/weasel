---
"@weasel-js/ui": patch
---

A timeline drops its selected key, reporting `null` to `onSelectionChange`, once the consumer changes that key's track so the selected index may name another key, as it already did for a selected segment.

<!-- entry: fix -->
