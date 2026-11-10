---
"@weasel-js/theme": patch
---

`readCssNumber`, and so `tokenPx` and `parseBoxShadow`, read a number with a leading `+` or an exponent (`+4px`, `1e1px`) as CSS does, rather than refusing it.
