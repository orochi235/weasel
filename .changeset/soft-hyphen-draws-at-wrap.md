---
"@weasel-js/text": patch
---

A line wrapped at a soft hyphen (U+00AD) now ends in a hyphen, as CSS's `hyphens: manual` draws it: the face's U+2010, or its U+002D where it has no U+2010, on the atlas, canvas, and outline tiers and in shaped runs, and in `measureText` and `layoutMarkdown` lines. The wrap measures such a line with its hyphen, so it ends at a soft hyphen only when the hyphen fits too. A soft hyphen anywhere else draws nothing and takes no room on every tier, including in a face that maps it to a visible glyph, and `textToPath` no longer outlines that glyph.
