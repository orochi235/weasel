---
"@weasel-js/routing": patch
---

`keySpecShortcut` gives no chip to a key binding that requires Ctrl or Meta beside `mod`, as it already did for one requiring either alone: the matcher requires both keys, so a chip drawing only `mod` named a different chord.
