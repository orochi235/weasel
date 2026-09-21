---
'@weasel-js/ui': patch
'@weasel-js/theme': patch
---

Slider readouts in inline rows take less width.

- The readout's width is four digits (`calc(4.5ch + 2px)`) rather than `2.8em`, so it follows the digit width of the face, and every readout in a column is the same box: the sliders beside them end on one line. A range whose widest value needs more than four characters widens its own readout. `--wzl-property-readout-w` still overrides the width.
- A word unit (`ms`, `px`, `%`) in an inline row hangs below the digits in capitals instead of sitting beside them, taken out of flow so a row with a unit is the same height and width as one without. Stacked rows, whose readout sits on the label line, keep the unit beside the value.
