---
'@weasel-js/quantity': patch
---

A negative number in a locale that writes a bidi mark before its sign (`ar-EG`) now shows the real minus sign in every kind and is spoken "minus …": `bytes`, `unit`, `roman`, `multiplier` and `formatNumber` kept the ASCII hyphen there, and no kind spoke the sign. `signed` and `spokenSign` look past such a mark, and every kind writes its sign through `signed`.
