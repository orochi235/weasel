---
"@weasel-js/core": patch
---

The `editAnchors` dep's `handleLocks` is read live, so a handle lock toggled during a handle drag or a balance-grip drag takes effect at once; the drag used to keep the locks as they stood at its press.
