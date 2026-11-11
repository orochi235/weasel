---
"@weasel-js/font": patch
---

`cssFamilyName`, `cssFontFamily`, and the `@font-face` source of a URL registration quote a name as CSS reads a
string, so a family holding a line break or a control character keeps its name. They quoted with `JSON.stringify`,
whose `\n` and `\u0001` CSS reads as the letters `n` and `u0001`, and the name named another family.
