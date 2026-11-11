---
"@weasel-js/guides": patch
---

`replaceGuideOp` undoes to the guide the store held when it applied, not the `from` it was handed, which may be stale; over an id the store did not hold, undoing it removes the guide it added, where it put `from` there.
