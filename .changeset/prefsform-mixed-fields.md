---
'@weasel-js/ui': patch
---

`PrefsForm`'s `mixed` names a field inside an `object` or a `union` leaf by its own path (`appearance.stroke.width`), and that field draws in its mixed state where it used to draw its default. **Breaking for an owner that passes `mixed`:** while an object leaf's path, or any path under it, is in `mixed`, editing one of its fields calls `onChange` at the field's path (`onChange('appearance.stroke.width', 3)`) and no longer with the whole object, which an owner writing to every value used to drop each one's other fields. An object with nothing mixed under it still commits whole.

A `list` or a `map` leaf at a mixed path draws the word `Mixed` in place of its editor, where it read as `None` and `Add` wrote a one-entry list over every value. A `union` leaf at a mixed path draws its choice as mixed and no variant's fields, where it read "Choose option…". `PrefMixed` is that word, exported, and `SelectionPanel` draws the same one.

`PrefRenderContext` gains `mixedAt` and `setValueAt`, for a renderer that draws fields of its own.
