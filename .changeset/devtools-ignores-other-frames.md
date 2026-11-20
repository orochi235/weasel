---
'@weasel-js/devtools': patch
---

The devtools hook ignores messages posted by another frame, so an embedded iframe can't take over the panel's session. The window transports ignore them too.

<!-- entry: fix -->
