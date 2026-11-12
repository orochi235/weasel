---
"@weasel-js/text-dom": patch
---

Undo and Redo inside a text edit take back a restyle, a paste, or anything typed, and put the selection back where it was.

Mod+Z, Shift+Mod+Z and Mod+Y step a history the edit keeps itself; the edit's `commit` still writes the result as one change.

<!-- entry: rank=10 fix -->
