---
'@weasel-js/font': patch
---

`parseBmFont` accepted metrics JSON with a missing `info.size`, `common.base`, `common.scaleW`, or `common.scaleH`, and every glyph then laid out at `NaN`. It now throws, naming the field, as its documentation says.
