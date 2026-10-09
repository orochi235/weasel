---
"@weasel-js/ui": patch
"@weasel-js/theme": patch
"@weasel-js/routing": patch
"@weasel-js/core": patch
"@weasel-js/labkit": patch
---

`PrefSchemaEditor` now has undo and redo: Undo and Redo buttons over the structure, and Mod+Z, Shift+Mod+Z, and Mod+Y anywhere inside it. A run of edits to one node's attributes undoes as one step, and undo restores the selection. A `schema` the editor did not write itself starts the history over. Add pref and Add group no longer create a node with a made-up key: each opens a dialog asking for a name, an id, and a pref's kind; the id follows the name in camelCase until it is typed into, and a taken or invalid id is refused. The structure tree shows each node as its name with its key beside it, or its key alone when it has no name. Each pane has a header, and the preview's carries a Show hidden switch and Reset values. The exported literal is syntax-highlighted.

`@weasel-js/ui` adds `CodeBlock`, a syntax-highlighted block of source with optional line numbers, built on `prism-react-renderer` and colored from the new `--wzl-code-keyword`, `--wzl-code-string`, `--wzl-code-number`, `--wzl-code-constant`, `--wzl-code-property`, and `--wzl-code-name` theme tokens, which have a value for each mode.

`historyKey(event)` (`@weasel-js/routing`, re-exported from core) says whether a key event asks for undo or redo. labkit's trial chrome and `LayeredCurveEditor` now read their undo keys through it, so Mod+Y redoes in both.
