---
'@weasel-js/ui': patch
'@weasel-js/prefs': patch
'@weasel-js/labkit': patch
---

`ActionBar` is a `Bar` of `action` leaves, one per registered action in its group, so it draws its buttons, tooltips, and disabled and pressed states the way every other bar does. Breaking: its `icons` prop takes icon names (`Record<string, string>`, glyphs of the kit's icon set, as a leaf's `icon`) where it took `ReactNode`s, and its buttons no longer carry `data-testid="action-bar-item-<key>"`; find one by its role and name. `Bar`'s gap reads `--bar-gap`, which `ActionBar` sets to keep its buttons close.

A group or a section drawn `as: 'bar'` says what happens to the cells its line has no room for. Additive: `PrefGroup` and `PrefSection` gain `overflow` (`'scroll'`, the default, or `'menu'`), typed `PrefBarOverflow`, and every surface that draws such a bar reads it: `Bar` (under its own `overflow` prop), `PrefsForm`, `SelectionPanel`, an object leaf's rows, and labkit's `ControlPanel`, whose builder gains `.overflow()`. `PrefSchemaEditor` offers it as "Overflow" on a node drawn as a bar. A form that takes drops, as the schema editor's preview does, keeps every cell on the line whatever the group says, so each stays a place to drop beside. `scroll` stays the default because a bar set to `menu` takes all the room its host has along the line.
