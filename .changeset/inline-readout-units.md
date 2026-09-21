---
'@weasel-js/ui': patch
'@weasel-js/theme': patch
---

Slider readouts in inline rows take less width.

- The readout no longer has a `2.8em` minimum. It is sized to the widest value its range and step can show, so a `0`–`30` slider gets a two-digit box rather than the same box as `1200`. `--wzl-property-readout-w` still sets a minimum; its default is now `0px`.
- A word unit (`ms`, `px`, `%`) in an inline row hangs below the digits in capitals instead of sitting beside them, taken out of flow so a row with a unit is the same height and width as one without. Stacked rows, whose readout sits on the label line, keep the unit beside the value.
