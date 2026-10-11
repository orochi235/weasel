---
'@weasel-js/labkit': patch
---

Under React `StrictMode`, an instrument's `job` with `auto: true` never ran and reported `running` forever: the rehearsal unmount aborted the first start, and the remount took it for already started. `useJob` now starts it again.
