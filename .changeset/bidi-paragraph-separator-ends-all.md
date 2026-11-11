---
"@weasel-js/bidi": patch
---

A paragraph separator handed to `analyze` mid-text ends every embedding, override and isolate open before it, as UAX #9's X8 says. Paragraph separators are a line feed, carriage return, U+001C–U+001E, U+0085 and U+2029. No isolate pairs with a `PDI` past one, and `'auto'` reads the paragraph's direction from before the first separator only.

<!-- entry: fix -->
