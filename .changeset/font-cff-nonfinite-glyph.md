---
"@weasel-js/font": patch
---

A glyph in a CFF face whose charstring reads past its operands is refused, and costs that glyph alone, as any glyph
the outline parser cannot read does. opentype.js writes the coordinates such a charstring lacks as `NaN`, and the
outline tier handed out path data holding them.
