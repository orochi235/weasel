---
"@weasel-js/cursor": patch
---

The painted-cursor store treats a `NaN` angle, size, radius, or pointer coordinate written again as no change, and does not notify.

<!-- entry: rank=-5 fix -->
