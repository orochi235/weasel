---
"@weasel-js/paint": patch
---

`paintKey` gives every fully transparent solid one key, whatever its color, so invisible runs of text in different colors share a draw call.
