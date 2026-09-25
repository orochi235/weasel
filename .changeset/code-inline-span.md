---
'@weasel-js/ui': patch
---

New `Code` component: an inline `<code>` span for literal text — identifiers, types, key paths — in the monospace face. `status` colors it (`neutral`, `muted`, `accent`, `success`, `warn`, `danger`; `success` and `danger` serve as a diff's added and removed sides), `variant` picks a tinted chip (`subtle`) or bare colored text (`plain`), and `size` pins the type to a theme step or, left unset, follows the surrounding text. The text keeps its case and wraps anywhere, with the chip repeating its padding on each line, so a long type signature breaks cleanly. `Badge` stays the label chip; it uppercases and was not built to quote.
