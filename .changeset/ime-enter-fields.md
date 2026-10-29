---
'@weasel-js/diagram': patch
'@weasel-js/ui': patch
---

More text fields leave a key to an input method mid-composition, so confirming a Japanese or Chinese candidate with Enter no longer commits, runs or adds what is half typed: `LayerList`'s rename field, `ListEditor`'s entries, `TokenField`, `CommandPalette`'s search, `UnitField`, a `PropertyField` text or number field, and the schema editor's key and number fields in `@weasel-js/ui`, and the effect editor's group title field in `@weasel-js/diagram`.
