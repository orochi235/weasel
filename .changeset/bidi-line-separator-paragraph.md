---
"@weasel-js/text": patch
---

A line separator (U+2028), VT or FF ends only a line, not its bidi paragraph, so the next line keeps the paragraph's direction. Embeddings carry over too, and `paragraphDirection` reads past one, as UAX #9 has it. LF, CR, NEL and U+2029 still start a new paragraph.

<!-- entry: fix -->
