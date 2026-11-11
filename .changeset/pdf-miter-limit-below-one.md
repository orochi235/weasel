---
"@weasel-js/pdf": patch
---

A stroke with a miter limit below 1 is written to PDF with a limit of 1, which bevels every corner as the renderer does.

<!-- entry: rank=-5 fix -->
