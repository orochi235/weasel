---
'@weasel-js/quantity': patch
---

`scientific()`, a display kind for powers of ten: `1.23 × 10⁶` at three significant figures by default, `engineering: true` for exponents in multiples of three (`12.3 × 10³`), and `form: 'e'` for `1.23e6`. It speaks `1.23 times 10 to the power of 6`, has a MathML form, and reads back its own text as well as `1.23e6`, `1.23*10^6`, and `1.23 x 10^-4`.
