---
"@weasel-js/registry": patch
---

`matchQuery` matches text however its accents are encoded, so `é` finds an `e` plus a combining acute (as macOS file names spell it).

<!-- entry: fix -->
