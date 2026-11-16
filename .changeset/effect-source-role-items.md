---
'@weasel-js/core': major
---

`effectSourceFor` and `effectsShowing` name the source a path effect lays as items with the role `'items'`, in place of `'text'`.

This is breaking: pass `'items'` where you passed `'text'`. The role now finds any source whose painter declares `effectItems`, text's among them.

<!-- entry: breaking api -->
