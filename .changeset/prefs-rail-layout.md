---
'@weasel-js/ui': patch
'@weasel-js/theme': patch
---

`PrefsForm` grows a second layout. `layout="rail"` puts a two-level navigation
rail beside one group's settings at a time: top-level groups open a pane,
nested groups scroll it and light up as they pass, and anything deeper renders
as an indented section in the pane rather than growing the rail. `filterable`
adds a field that narrows the form to matching leaves in either layout, with
per-group match counts in the rail.

The default `layout="columns"` is untouched.

Also new, and useful on their own: `useScrollSpy` (which section of a scrolling
container is in view, with its decision exposed as the pure `pickActiveSection`),
`Dialog`'s `bodyClassName` for content that scrolls itself, `PrefsDialog`'s
`footer` passthrough, and two theme hooks — `--wzl-prefs-rail-width` and
`--wzl-input-surface`, the latter for a text field on a container whose own
background is the default sunken surface, where it was previously the same
color as what sat behind it.
