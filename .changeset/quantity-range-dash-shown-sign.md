---
'@weasel-js/quantity': patch
---

A range's dash is spaced only when an end shows a minus sign, so a negative end that rounds to `0` writes `0–5`, not `0 – 5`.

<!-- entry: fix visual -->
