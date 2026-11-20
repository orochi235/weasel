---
'@weasel-js/prefs': patch
---

The Bundles tree keeps two bundles apart whose ids differ only in punctuation. Ids like `editing:shapes` and `editing.shapes` each get a group, and each link reaches its own.

<!-- entry: fix -->
