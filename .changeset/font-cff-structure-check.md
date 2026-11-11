---
"@weasel-js/font": patch
---

The default outline parser checks a CFF (`.otf`) face's `CFF ` table before opentype.js reads it, and refuses one whose
INDEX or DICT structures run past the table, whose INDEX offsets are out of order or wider than 4 bytes, or whose
top DICT gives an offset operator the wrong number of operands. opentype.js trusts the table: given such an operand
list where it expects an offset, it built the offset as a string, and one damaged 2.6 KB face held the parser, and the
page, for about a minute.
