---
'@weasel-js/ui': patch
---

A disabled inline paint (`kind="paint"` with `control="inline"`, which is what `SelectionPanel` draws) is its editor made inert, where it was a swatch. The swatch is one line and the editor is two or more, so a row whose `enableIf` flipped changed height and moved every row under it: 27px for a solid paint, 117px for a gradient. The disabled editor is a `group` carrying the paint's name and `aria-disabled`, dimmed once, with its controls out of the focus order. A disabled paint in its default swatch form is unchanged.
