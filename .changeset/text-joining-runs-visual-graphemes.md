---
'@weasel-js/text': minor
---

`joiningRuns` groups graphemes that join, as Arabic letters do, and `visualGraphemes` puts graphemes in display order.

Both are what `CurvedLabel` lays a label out with; `visualGraphemes` reorders through the registered bidi engine. With no bidi engine registered, the warning about right-to-left text now opens `weasel visualGraphemes:` rather than `weasel CurvedLabel:`.

<!-- entry: new api behavior -->
