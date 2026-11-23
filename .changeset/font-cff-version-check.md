---
'@weasel-js/font': patch
---

The outline parser checks a face's `CFF2` table, and a `CFF ` table whose header names version 0, before reading it, and refuses one that is damaged instead of hanging on it.

<!-- entry: fix -->
