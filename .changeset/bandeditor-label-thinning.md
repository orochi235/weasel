---
"@weasel-js/ui": patch
---

`BandEditor`'s ruler no longer lets its tick labels run into each other. Where two labels would come
within 4px, one gives way and its notch is drawn unlabeled: the range's end labels always stay, then
a tick of lower `level` (a new optional field on a tick, 0 by default) outlasts a higher one, then the
rounder value outlasts the less round one — 1/3 before 1/12, 50 before 40 — then the leftmost. The
ruler rechecks when it is resized. `BandTick` names a tick's type.

A `fraction()` display with no `form` of its own is drawn stacked on the ruler, numerator over
denominator, at about half the width of `1/12` written inline; the ruler grows to 28px tall to hold
it. Pass `fraction({ form: 'inline' })` to keep the inline form.
