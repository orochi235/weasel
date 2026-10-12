---
'@weasel-js/ui': patch
---

`AssetEditor`'s asset list is set as the prefs dialog's list of pages is: each heading at the size of a page's name, its assets a step in under it and lighter, and the one shown filled in the accent. An asset marked `readOnly` carries a bolt in place of a padlock, named "Dynamic": its rows are worked out, and so not edited.

Adds the `bolt` glyph and `BoltIcon`.

A `Tree` with `guides` draws each branch's bracket from under the middle of the branch's mark, and stands each level a mark's width in from the one above. A row with no mark starts its name where a branch beside it starts its mark. Folded by its leading glyphs (`foldBy="leading"`), a tree leaves 6px between a glyph and its label, where it left 2px.
