---
'@weasel-js/ui': patch
---

A stacked fraction's bar reaches past its digits by the same amount on each side, rather than further on the
right, so on the BandEditor ruler the bar and both rows of digits center on the tick. A browser test reads the
ruler's pixels to hold that, since the bar has no box of its own to measure.
