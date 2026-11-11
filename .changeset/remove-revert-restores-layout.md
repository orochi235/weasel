---
'@weasel-js/core': patch
---

Undoing a removal from a history read back from JSON gives each node back its layout and other function fields.

They are restored from their registry keys even where the saved node holds something under that field.

<!-- entry: fix data -->
