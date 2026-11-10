---
'@weasel-js/text': patch
---

Place the caret on the side of the character under the pointer in `caretIndexAt`, so a click where right-to-left text meets left-to-right text reaches every offset there. A click in the right half of the last letter before a Hebrew word used to land after the word.
