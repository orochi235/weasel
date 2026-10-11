---
'@weasel-js/ui': patch
---

`PrefSchemaEditor` edits `showIf` and `enableIf`. A pref, a group, and a section each get a "Shown if" and an "Enabled if" row in the attributes pane, drawn with `PrefConditionEditor` over the schema being edited; a label and a separator get "Shown if" alone. A leaf made from a type sets both where it is used, and a kind change carries them over. Each edit is a step Undo takes back, and the condition lands in the draft and in the exported literal. With several nodes selected the row sets one condition on all of them, and conditions that differ are listed as mixed with no control. A node whose condition reads a path no leaf holds a value at, or compares a leaf against a value its kind or options rule out (after the leaf it read was removed or changed kind, say) keeps the condition, and its row in the structure tree carries a "bad condition" mark whose tooltip says what is wrong; the same words show under the condition's row in the attributes pane.
