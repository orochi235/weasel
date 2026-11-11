---
"@weasel-js/plot": patch
---

`formatGanttEnd` writes a duration's amount in digits (`0.0000001d`), never with an exponent, so `parseGanttEnd` reads it back as a duration.

<!-- entry: fix data -->
