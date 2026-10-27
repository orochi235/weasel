---
'@weasel-js/diagram': patch
---

`DiagramView` can pick several at once: `selectionMode="multiple"` lets Shift-click add a node, group or edge to the pick or take it out, `selected` takes an array as well as one id, and `onSelect` gets every id picked as a second argument beside the latest pick. Adds API; an `onSelect` taking one argument keeps working. `EffectEditor` picks this way, and its `onSelect` likewise gets every stage and group picked as a second argument, for `EffectEditorApi.group`.
