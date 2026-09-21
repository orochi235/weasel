---
'@weasel-js/ui': patch
---

`<Select>` takes an `indicator`: `'chevron'`, `'underline'` or `'none'`. A
boxed select still draws the caret; a `variant='bare'` one — the shape a
property row and a labkit control panel use — now underlines its value
instead, dotted at rest and solid under the pointer. In a row that gives the
value 60px, the caret was spending a sixth of it to say what the underline
says in the value's own space. Pass `indicator` to override either default.

A select's list now opens **over** its trigger, with the selected row on the
value: same line, same text column, and the same edge the trigger sets its
value against, so choosing what is already chosen moves nothing.
`popup='below'` keeps the old dropdown, which takes the trigger's width. The
alignment is handed back as the popover's own offsets, so React Aria still
holds the list inside the viewport.
