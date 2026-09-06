---
'@weasel-js/ui': patch
---

A property-row number field drops the browser's spin buttons.

Chrome reserves the spin-button gutter at a number input's right edge whether or
not it paints the arrows. The field right-aligns its value, so the digits stopped
about 20px short of their own border and the row read as if something belonged in
that space — a unit, most obviously, which is exactly where a unit does not go:
`NumberRow` renders `unit` as a sibling of the input, outside its border.

The panel drives numbers by typing and by dragging the paired slider, never by
the steppers, and the slider's own inline readout has always dropped them. The
typed field beside it now does too.
