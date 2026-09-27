---
'@weasel-js/quantity': patch
---

`fraction()` gains two options. `form: 'diagonal'` writes the fraction as superscript digits, the fraction slash and subscript digits (`¹⁄₁₂`), so it stays diagonal wherever the text is drawn, and every fraction display reads that form back. `of` counts in a named constant: `fraction({ of: 'π' })` shows `3π/4`, speaks `3 pi over 4` and reads `3pi/4` back; `π`, `τ` and `e` are built in as `CONSTANTS`, and any `{ symbol, value, spoken }` works. `of` cannot be combined with `mixed`.

Unit fields that accept `in` or `ft` now also accept `"` and `'`, the primes, and the curly quotes a keyboard substitutes for them, and the reverse; `unit('"')` shows inches with the mark and speaks them as inches.
