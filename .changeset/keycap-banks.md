---
"@weasel-js/ui": patch
---

New `KeyBank` groups keycaps that print their legends at one size, as a
keyboard's function row or navigation cluster does. Each `KeyCap` inside picks
the spelling of its legend that fits its key best — `Ins` for `Insert`, `Bksp`
for `Backspace` — and every single-line legend in the bank then prints at the
smallest scale any of them needs, floored at `minScale` (0.6 by default); a
function key in a bank drops its smaller default size so it matches Esc. With
`wrap`, on the bank or on one `KeyCap`, a key may print a two-line spelling
such as `Pg`/`Up` instead of shrinking; that key sizes itself. The spellings
table is exported as `KEY_SPELLINGS` and replaced per bank with `spellings`.
Only a key whose width its layout sets is fitted — one given a `style` width,
a square key, or one marked `fixed`; a key sized by its own legend prints its
first spelling at the bank's scale. Keycaps outside a bank render as before.
