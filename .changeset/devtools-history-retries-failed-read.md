---
'@weasel-js/devtools': patch
---

The devtools History tab retries a failed read on its own, as the Dispatch tab does, rather than waiting for the next history change.

<!-- entry: fix -->
