---
'@weasel-js/cursor': patch
---

A cursor sink with no base, clearing an override that replaced another, puts back the cursor other code wrote on the element in between, rather than the one from before the first override.

<!-- entry: fix -->
