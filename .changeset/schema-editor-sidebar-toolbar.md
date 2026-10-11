---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` gains a right sidebar beside the live preview, empty for now, with a handle to resize it; it runs the editor's height under the bar, as the structure pane does at the other edge. Undo, Redo, Discard draft, and Preferences are tool buttons in a palette of their own at the bar's end, where they were text buttons. A group's row in the structure tree no longer carries a badge naming how it is drawn, since its glyph says so; it keeps its count.

A `Tree` folded by its leading glyphs leaves 2px between a branch's glyph and its label, so each level steps in 18px.
