---
'@weasel-js/labkit': patch
---

Marks saved in the old vertex format are no longer collapsed to a point when their scene loads before the target declares its content size; they stay as saved until the size is known.
