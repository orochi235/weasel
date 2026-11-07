---
'@weasel-js/svg': patch
---

A marker's solid fill or stroke and a pattern tile's line stroke wrote their color into the attribute unescaped, where every other color writer escapes it.
