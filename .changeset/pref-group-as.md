---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A `PrefGroup` can say how it is drawn, with `as`: `'page'` (an entry in the form's rail and a pane of its own), `'tab'` (one tab in a strip shared with the `tab` groups beside it), `'panel'` (a bordered, titled box), or `'section'` (a heading over its rows). Unset, depth decides as before: a top-level group is a page and a nested one a section. `PrefsForm`'s rail layout draws all four; a top-level group that is not a page is drawn on the root's own page, with the root's leaves. Its columns and list layouts, and labkit's `ControlPanel`, draw tabs, panels, and sections; they have no pages, so `'page'` draws as the default there. labkit's `f.group(...)` takes `.as(kind)`. `PrefSchemaEditor` sets it from a group's "Drawn as" attribute, and its tree files non-page top-level groups under General.

`prefGroupIsPage` and the `PrefGroupAs` type are exported from `@weasel-js/prefs`.

A `PrefSection` takes `as` too, without `'page'`: `SelectionPanel` draws a run of tab sections as one strip and a panel section in a box, and so do the sections inside an object leaf, in both `SelectionPanel` and `PrefsForm`. `GroupTabs` is the one tab strip all of them use, exported from `@weasel-js/ui`. `PrefSchemaEditor` offers "Drawn as" on a section and a palette of tab, panel, and section for a section schema.
