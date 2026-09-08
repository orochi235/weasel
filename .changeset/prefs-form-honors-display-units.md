---
'@weasel-js/ui': patch
---

`PrefsForm` honors a number leaf's display unit, and renders `font-family` as a
real control.

A leaf declaring `unit` — `pose.rotation` stores radians and shows degrees —
was rendered raw: the field showed radians against a degree suffix that was not
drawn, and typing a number wrote it straight through. Both the input and the
slider now convert the value with `toDisplay`, convert back with `fromDisplay`
on every write, convert the leaf's declared `min` / `max` / `step`, and draw the
suffix beside the field. A leaf with no `unit` takes the untouched path.

`prefDisplayBounds` is the bounds conversion, exported from the Prefs schema
module. `SelectionPanel` held a private copy and now imports this one.

A `font-family` leaf drew "no renderer" text. It now renders a
`FontFamilySelect` over the live font registry, keeping an unregistered family
visible and labeled with what actually paints. A consumer-supplied
`renderers['font-family']` still wins.
