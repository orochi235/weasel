---
"@weasel-js/ui": patch
---

`PaintInput` and `PaintField` never write a solid paint when `kinds` leaves out `solid`, even for a mixed or missing value.

That value shows no color field under the kind bar; a kind is picked in the bar.

<!-- entry: fix -->
