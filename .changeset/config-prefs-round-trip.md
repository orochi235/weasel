---
'@weasel-js/labkit': patch
---

New `prefsFromConfig(resolved)` turns a resolved config into the property schema `PrefSchemaEditor` opens:
each `.section()` a `PrefSection` over the nodes it heads, each `f.group` an `object` leaf at its key, so
the editor's structure tree shows the sections and every config path stays where it was. `f.prefs` reads
the editor's export back as that schema. A node's `.render`, `.dialog`, and function `.showIf` or
`.enableIf`, a group's `as`, `overflow`, `.resettable()`, and motif, and a section's `collapsed`, `layout`,
`pack`, `className`, and motif ride on the node beside its prefs fields, so they survive an edit and print
in the export, code as `KEEP_FROM_SOURCE`.
