---
'@weasel-js/ui': patch
---

`Slider` with `endless` and no `step`: the arrow keys now move a thumb onto the infinity stop and off it. A thumb at `Infinity` stayed there under ArrowLeft, and ArrowRight from the top of the range never arrived, because one keystroke covered less than half the gap the stop is drawn across. The stop is now one press past the range's end, and a larger move that would overshoot the end lands on the end first. With `stops` on a linear track, the infinity stop joins them, so arrow keys and a `snap: 'strict'` drag can land on it; it is labeled when the other stops are.
