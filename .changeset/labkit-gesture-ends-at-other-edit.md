---
"@weasel-js/labkit": patch
---

A run of writes to one setting now ends at any edit recorded between two of them, such as a mark or a step on the instrument's own history, so Undo takes back the last write rather than the edit before it.
