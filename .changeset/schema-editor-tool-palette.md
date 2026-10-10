---
'@weasel-js/ui': patch
---

`PrefSchemaEditor`'s palette is a row of tool buttons, a glyph over a name, in place of dashed text chips; each is still dragged into the tree or the live preview. The glyphs are new in the icon set: `formPage`, `formTab`, `formPanel`, `formSection`, and `formLabel`.

Delete or Backspace removes the selected node, from anywhere in the editor but a field, where the key still edits the field.

What follows the pointer while a new item, or a row picked up in the live preview, is dragged is that node drawn as the form will draw it: a leaf as its row, a page as a rail entry, and any other group as its tab, box, or heading. A drag begun in the structure tree still shows the tree's rows.

Each branch of the structure tree shows how many leaves it holds, at any depth, in a badge before its kind, and a group's row leads with the glyph of the palette tool that makes it.

The structure tree's text is the size of the fields beside it, 15px by default, up from 13px, and a row's key is in the UI font at light weight where it was monospace. `Tree` reads its text size from `--wzl-tree-font-size`, which falls back to the size it had.
