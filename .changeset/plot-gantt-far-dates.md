---
"@weasel-js/plot": patch
---

A gantt task whose end is past what a `Date` or a number holds is drawn instead of producing `NaN`.

A duration of months past the year 275760 ends 30 days a month on, and one past the double range ends at its edge. `parseGanttDate` refuses `x` and `X` digits past the double range. A chart whose tasks all sit too far out for a day to move them spans more than one instant.

<!-- entry: rank=-5 fix -->
