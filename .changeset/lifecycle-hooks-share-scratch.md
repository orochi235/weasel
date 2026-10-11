---
'@weasel-js/routing': patch
---

A tool's `onActivate` and `onDeactivate` each received a fresh `initScratch()` result, so anything `onActivate` stored on `scratch` (a subscription to release, say) was gone by `onDeactivate`. The two now receive the same object for one stretch of the tool being live, and a new one the next time it becomes live.
