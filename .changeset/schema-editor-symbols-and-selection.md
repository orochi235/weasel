---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` sets the fields that hold what the code will spell in monospace: a node's key, the id in the add dialog, an enum option's stored value, a union's tag, an icon's name, and the kinds a `field` leaf accepts. Its structure tree indents each level 6px further, so a child no longer reads as beside its parent's glyph.

A `PrefsForm` marks its selected row or group in the secondary accent where it used the primary one, which is a control's own color and made the mark read as one more control state.
