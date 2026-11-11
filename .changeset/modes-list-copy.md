---
"@weasel-js/modes": patch
---

A mode registry keeps its own copy of the modes it was built from, so `list()` stays the modes it registered when the caller later changes the array it passed. It had handed back that array, which could then list a mode `byId` refused.
