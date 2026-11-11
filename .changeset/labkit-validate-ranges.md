---
"@weasel-js/labkit": patch
---

`validateConfigSchema` refuses a slider whose `min` or `max` is not a finite number, and a number field whose default lies outside its own `min` and `max`, whose `min` is above its `max`, or whose bounds are `NaN`. These passed as valid, and drew a control that could not hold its own default.
