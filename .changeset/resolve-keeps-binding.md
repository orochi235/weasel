---
'@weasel-js/renderer': patch
---

Copying a retained surface out of its multisampled buffer now leaves whichever framebuffer was bound before it, rather than the default one. No drawn output changes: the one caller already rebound its target afterward.
