---
'@weasel-js/forge': patch
---

`watchRecovery` stops checking files once a restarted dev server closes, and a restarted server starts with none of the last one's files.

<!-- entry: fix -->
