---
'@weasel-js/text-shaping': patch
---

A closing angle bracket that is a canonical equivalent of its opener's pair now goes with the opener's script.

`〈שלום〉` written with U+2329 and U+3009 pairs as `@weasel-js/bidi` pairs it, so the closer is shaped with the text after the brackets.

<!-- entry: fix visual -->
