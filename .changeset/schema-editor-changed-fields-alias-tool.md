---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` marks what changed inside a node as well as which nodes changed: in the Attributes pane, the label of each attribute that differs from the baseline is drawn in the accent color, the Key's among them when a move or rename gave the node another key. The bar gains an Add alias tool, which sets an alias of the selected pref right after it.

`PrefsForm` takes `changed`, a set of paths whose rows are marked that way, and `PropertyRow` takes a `changed` flag that does the marking. What counts as changed is the caller's to say.

A `Tree` folded by its rows' leading glyphs (`foldBy="leading"`) hangs a branch's glyph in the row's gutter, as it does the fold mark, where it used to keep an empty gutter and set the glyph after it. A branch's label and a leaf's at the same level now start at the same x, and each level sits one glyph's width further in. `--wzl-tree-fold-size` (default `16px`) says how wide the glyph is. The schema editor's two trees drop their own wider indent for this.
