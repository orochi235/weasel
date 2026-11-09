---
"@weasel-js/text": patch
---

A line separator (U+2028), VT or FF now ends only a line, not its bidi paragraph, as UAX #9 has it: the line after one keeps the paragraph's direction and embeddings, and `paragraphDirection` reads past it. LF, CR, NEL and U+2029 still start a new paragraph.
