---
'@weasel-js/ui': patch
---

`CurvedLabel` lays its text in the order the Unicode bidi algorithm shows it under the label's computed `direction`: a Hebrew or Arabic word reads right to left, a bracket in a right-to-left stretch takes its mirrored glyph, and in a right-to-left locale `align: 'start'` puts the text against the run's right end. `@weasel-js/ui` now depends on `@weasel-js/bidi`. Arabic letters still lose their joining forms, as each grapheme is its own span.
