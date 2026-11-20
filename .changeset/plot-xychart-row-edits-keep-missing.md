---
'@weasel-js/plot': patch
---

An xychart row edit leaves a series' missing values missing rather than drawing them as zeros.

Inserting, removing, or moving a row, or setting a value past a series' end, writes a value the series lacks inside its length as `NaN`, which the chart draws as no point.

<!-- entry: fix visual data -->
