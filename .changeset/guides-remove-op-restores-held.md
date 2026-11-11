---
"@weasel-js/guides": patch
---

`removeGuideOp` over an id the store does not hold is a no-op, so no undo step, where undoing it added the guide it was handed. Undoing a removal puts back the guide the store held, not the copy the op was handed, which may be stale.
