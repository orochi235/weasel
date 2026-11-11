---
"@weasel-js/guides": patch
---

Undoing `replaceGuideOp` restores the guide the store held when it applied, not the `from` it was handed, which may be stale.

Over an id the store did not hold, undoing it removes the guide it added.

<!-- entry: fix -->
