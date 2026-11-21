---
'@weasel-js/ui': patch
---

A curve editor made disabled or read-only mid-drag cancels the drag, reporting `onCancel` and no further `onInput` or `onChange`.

<!-- entry: fix -->
