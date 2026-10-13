---
'@weasel-js/ui': patch
---

The text in `PrefSchemaEditor`'s structure pane starts at one edge. A pane's title, the filter's text, a top-level leaf's name, and the line an empty list shows now start where a group's name does, past the glyph that folds it; they stood at four different insets.

`Tree` reads `--wzl-tree-root-leaf-indent`, the `--wzl-tree-leaf-indent` of a leaf no branch holds, for a host whose own text stands at another edge.
