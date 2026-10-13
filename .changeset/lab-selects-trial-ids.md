---
'@weasel-js/labkit': patch
---

Fixes: a `Lab` rendered itself and its `Workspace` whenever any trial's record changed: a pan frame, a job item, a clock write, or a mark save. It now selects the trial ids alone, and only readers of `useLabContext` hear a record change.
