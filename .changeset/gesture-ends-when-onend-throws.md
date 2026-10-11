---
'@weasel-js/routing': patch
---

An ongoing action whose `onEnd` threw stayed in flight for good: the hover cursor stopped updating, its overlay kept drawing, and its tool's `phase: 'initial'` bindings stopped matching. The dispatcher now takes a gesture out of flight before calling its `onEnd`, logs a throw with `console.error` as it does for an immediate action, and `cancelAll` ends every remaining handle after one throws.
