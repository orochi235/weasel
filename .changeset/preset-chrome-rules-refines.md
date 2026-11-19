---
'@weasel-js/core': patch
---

Preset `chromeRules` for one chrome id follow `refines`, as every other preset merge does.

The refining preset's rule wins, and two unrelated presets giving different rules throw.

<!-- entry: fix behavior -->
