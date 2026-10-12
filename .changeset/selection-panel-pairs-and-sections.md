---
'@weasel-js/ui': patch
---

`SelectionPanel`'s `selected` and `onSelect` reach a paired row and a section. A row a `pair` draws for several leaves is marked when any of them is in `selected`, carries its first leaf's path, and reports that leaf on a press, inside an object leaf as well. A top-level section drawn under a heading, as a tab, or as a panel is named in `selected` by its own key, in the same list as leaf paths: it is marked, selecting it opens its tab, and a press on its heading, tab, or panel title reports the key. A nested section's key marks nothing.

`PrefSchemaEditor`'s section preview selects both with its structure tree. Under a section root it now refuses a section key that a leaf holds and a leaf key that a section holds, numbers a moved or copied node that would take one, and badges both rows of a loaded schema that already has such a pair as `key taken`. This is a change for a schema that named a section and a leaf alike: the editor flags it, and renaming either clears the badge.
