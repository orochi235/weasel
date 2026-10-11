---
'@weasel-js/forge': patch
---

`forge` (the vite plugin) and `Workshop`: a story file created while the dev server runs can be opened from the tree. It listed and then showed `No importer for <file>` until the page was reloaded, because the open page was never handed an importer for the new file. The same held for a story file that gained its first story after startup.
