---
"@weasel-js/ui": patch
---

`Select` rows now carry a `textValue`, derived from a string label or the
new per-option `textValue` for labels built from elements. Every row draws a
check mark beside its label, so React Aria could never read a string off the
children — it warned once per row on every open, and type-to-select did
nothing.
