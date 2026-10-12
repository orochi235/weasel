---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
---

`PrefsForm` and `PrefsDialog` take `over`, a `PrefGroup` or a `PrefSection`: the schema their `alias` leaves point into, when that is not the form's own. It replaces the `leafAt` function, which never shipped. An alias row is drawn as the leaf of `over` at the alias's path, reads and writes `values` at that path, and is hidden and disabled by that leaf's conditions and those of every group above it, as well as by its own. Those conditions read `values`, and `over`'s defaults where `values` holds nothing. Before, an alias into another schema answered to its own conditions alone.

Breaking: `filterPrefSubtree`'s fourth argument is the schema an alias's target is looked for in, where it was a function from a path to a leaf. A caller that passed `(path) => prefLeafAt(schema, path)` passes `schema`.

Adds API: `applyPrefConditions` and `prefScopeAt` take `aliasHolds` beside `aliasOver`, the judge of that schema's conditions when its values are not the ones the walked schema's judge reads. `prefReader` reads a `PrefSection` schema as well as a `PrefGroup`.

Fixes: an alias of an `object` leaf drew a field marked `hidden`, and a field whose `showIf` hid it in the leaf's own row, and left enabled a field an `enableIf` disabled there when the form left the leaf itself out. The alias row now shows the leaf as its own row would.

Fixes: `Bar` drew an alias as `(alias: no pref at …)` whatever it pointed at. It now draws the control of the leaf the alias shows, over that leaf's value, in a cell and in a row of a group it opens.
