---
"@weasel-js/bidi": patch
---

A paragraph separator (`B`: a line feed, carriage return, U+001C–U+001E, U+0085, U+2029) handed to `analyze` mid-text now ends every embedding, override, and isolate open before it, as UAX #9's X8 says, and no isolate pairs with a `PDI` past one. An LRI, line feed, letter, and PDI used to leave the PDI unresolved and the letter at level 2; all four now resolve at level 0. `'auto'` reads the paragraph's direction from before the first separator only.
