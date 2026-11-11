---
"@weasel-js/stroke": patch
---

A round- or square-capped dot (a zero-length subpath) more than 2^53 units from the origin is drawn instead of throwing
a `TypeError` from `tessellateStroke`.
