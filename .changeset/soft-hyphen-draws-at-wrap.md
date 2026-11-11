---
"@weasel-js/text": patch
---

A line wrapped at a soft hyphen (U+00AD) ends in a visible hyphen, as CSS's `hyphens: manual` draws it.

It draws the face's U+2010, or its U+002D where it has no U+2010, on the atlas, canvas and outline tiers and in shaped runs, and `measureText` and `layoutMarkdown` lines carry it. A line ends at a soft hyphen only when the hyphen fits too. A soft hyphen anywhere else draws nothing and takes no room on every tier, even in a face that maps it to a visible glyph, and `textToPath` does not outline it.

<!-- entry: behavior visual -->
