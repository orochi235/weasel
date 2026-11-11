---
"@weasel-js/labkit": patch
---

Undo after a mark made between two writes to one setting takes back the last write, not the mark. A run of writes to one setting ends at any edit recorded between them.

<!-- entry: fix -->
