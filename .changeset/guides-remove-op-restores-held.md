---
"@weasel-js/guides": patch
---

Undoing `removeGuideOp` puts back the guide the store held, not the copy the op was handed, which may be stale.

Over an id the store does not hold, the op is a no-op and records no undo step.

<!-- entry: fix -->
