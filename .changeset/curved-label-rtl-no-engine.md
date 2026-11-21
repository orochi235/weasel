---
'@weasel-js/text': patch
'@weasel-js/ui': patch
---

A `CurvedLabel` under `dir="rtl"` with no bidi engine registered reads its text forward instead of mirrored.

`visualGraphemes` with no engine returns graphemes in logical order left to right under `'rtl'` as well as `'ltr'`.

<!-- entry: fix visual -->
