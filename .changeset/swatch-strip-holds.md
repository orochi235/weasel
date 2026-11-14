---
'@weasel-js/ui': minor
---

`SwatchStrip` takes `disabled` and `readOnly`, and a `<Disabled>` or `<ReadOnly>` scope around it holds it.

Its recent row, its palette, and its palette picker are held as a `SwatchGrid` and a `Select` are, so a held strip applies and records nothing, and its root carries `data-held`.

<!-- entry: api new -->
