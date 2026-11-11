---
"@weasel-js/labkit": patch
---

`validateConfigSchema` refuses a slider or number field whose bounds are not finite or cannot hold its default.

That is a slider whose `min` or `max` is not a finite number, and a number field whose default lies outside its `min` and `max`, whose `min` is above its `max`, or whose bounds are `NaN`.

<!-- entry: fix -->
