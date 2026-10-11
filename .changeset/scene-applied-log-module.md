---
'@weasel-js/core': patch
---

Internal: The scene's atomic-revert log (the kit ops an edit has applied, and the all-or-nothing wrapper that takes them back) moves out of scene.ts into appliedLog.ts. No behavior change.
