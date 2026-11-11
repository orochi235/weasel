---
"@weasel-js/font": patch
---

`faceMetricsFromTables` leaves out a metric whose value, divided by the em, is not finite or is a rule 0 ems thick.

<!-- entry: fix -->
