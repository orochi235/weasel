---
"@weasel-js/ui": patch
---

`PaintInput` and `PaintField` show no color field for a mixed or missing value when `kinds` leaves out `solid`, so they never write a solid paint the control does not offer.

<!-- entry: fix -->
