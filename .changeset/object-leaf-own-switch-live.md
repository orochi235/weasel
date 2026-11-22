---
'@weasel-js/ui': minor
---

An object leaf turned off by its own `enableIf` can be turned back on from its switch field, in `PrefsForm` and `SelectionPanel`. The leaf's row dims its label and leaves each field to say whether it is disabled.

`PropertyRow` takes `holds` (default `true`) for that: `holds={false}` dims a disabled row's label without disabling the controls inside it, for a row whose controls each say whether they are disabled.

<!-- entry: fix api -->
