---
"@weasel-js/routing": patch
---

A tool option's size or strength step now moves a value whose `step` is fractional, such as 0.1. Rounding back to
the step could land a float error away from where it began, and the step then left the value where it was.
