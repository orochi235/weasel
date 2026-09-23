---
'@weasel-js/ui': patch
---

`PropertyRenderContext` carries `selectionKey`: the ids of the nodes a
`SelectionPanel` read its values from, joined. A custom renderer holding
scratch that belongs to one selection — a paint control's per-kind memory —
can key on it and be remounted when the selection changes, as the built-in
paint leaf already is. Fields of an object leaf receive it too. It is absent
where values come from no selection, as in `ToolOptionsBar`.
