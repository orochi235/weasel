---
"@weasel-js/plot": patch
---

A gantt task whose end is past what a `Date` or a number holds is drawn: a duration of months past the year 275760 ends 30 days a month on, and one past the double range ends at its edge, where both drew `NaN`. `parseGanttDate` refuses `x` and `X` digits past the double range rather than reading `Infinity`. A chart whose tasks all sit too far out for a day to move them spans more than one instant. `formatGanttEnd` writes a duration's amount in digits (`0.0000001d`), never with an exponent, which `parseGanttEnd` read back as a date.
