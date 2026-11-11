---
"@weasel-js/theme": patch
---

`readCssNumber`, and so `tokenPx` and `parseBoxShadow`, read a leading `+` or an exponent (`+4px`, `1e1px`) as CSS does.

<!-- entry: rank=-5 fix -->
