---
'@weasel-js/ui': patch
---

`PrefSchemaEditor`: a pair's "Row label" can be typed with a space in it. The label was trimmed on every keystroke, so `Line style` came out as `Linestyle`; it is now trimmed when the field is left.
