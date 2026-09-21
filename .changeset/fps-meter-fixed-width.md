---
'@weasel-js/labkit': patch
---

Stop a trial resizing itself as its frame rate ticks. `FpsMeter` held its
label and its number in one box with a `min-width` covering both, so every
digit the rate gained or lost changed the readout's width — and in a trial a
couple of hundred pixels wide, that wrapped the status bar onto a second line
and back, taking the height out of the canvas above it each time. The number
is its own cell now, wide enough for a three-digit rate and set in tabular
figures, and a status bar keeps its sections on one line and clips rather than
growing.
