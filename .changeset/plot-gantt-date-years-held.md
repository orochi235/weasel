---
'@weasel-js/plot': patch
---

Dragging a gantt task past the years its `dateFormat` writes stops at the last date the format reads back.

It no longer writes a date that sends the task to the chart's first date.

`YYYY` holds dates to years 0 through 9999, and `YY` to 1969 through 2068.

<!-- entry: fix -->
