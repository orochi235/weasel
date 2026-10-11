---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A `list`'s or a `map`'s `item` now has its conditions applied, in `PrefsForm`, `SelectionPanel`, `Bar`, and the dialog a labkit `ControlPanel` row opens. A field of an object item hides by its `showIf` and disables by its `enableIf` in every entry, and the item's own `enableIf` disables every entry's control. A path is still read from the schema root, so a field cannot yet name its sibling in the same entry, and an item's own `showIf` is not asked.

Adds API: `applyPrefConditions` walks an item, and names what it disables once for every entry, with `PREF_ENTRY` (`'*'`) as the entry's step: `'phases.*'` for the item, `'phases.*.hold'` for a field of it. `prefScopeAt` answers for a path inside an entry, whatever the entry's step. `PrefControl` takes `disabledAt`, for an owner that has applied the conditions itself. labkit adds `conditionedLeaf`, and the dialog a `ControlPanel` row opens for an object, a union, a list, or a map now hides and disables that leaf's fields by their conditions, which it did not do for any of them.
