---
'@weasel-js/ui': patch
---

`TokenField`'s Backspace moves to the last chip only from an empty field; with text typed, it leaves the text alone instead of turning it into a token.

<!-- entry: fix -->
