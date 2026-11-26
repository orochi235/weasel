---
'@weasel-js/history': patch
---

`History.restore` refuses a snapshot naming a negative entry id, floor, branch point or `nextEntryId` as malformed.

<!-- entry: fix -->
