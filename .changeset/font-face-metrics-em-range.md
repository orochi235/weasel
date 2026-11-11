---
"@weasel-js/font": patch
---

`faceMetricsFromTables` checks each metric after dividing it by the em, so a table holding values at a magnitude no
16-bit field holds leaves that metric out rather than stating it as `Infinity`, or a rule 0 ems thick.
