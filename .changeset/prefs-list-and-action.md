---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Two new built-in pref kinds.

A `list` leaf holds an array whose entries are each described by `item`, an ordinary leaf: `{ kind: 'list', item: { kind: 'number', min: 0 }, minItems: 3, maxItems: 3 }`. The item may be any kind, built-in or app-defined, including an `object` or another `list`. A stored list reads entry by entry through the item, so one bad entry falls back to the item's default and the rest are kept; a list shorter than `minItems` reads as the default and one longer than `maxItems` is cut to it. `PrefValueOf` types a list by what its item holds.

An `action` leaf holds no value: it is a button among the rows that calls `run({ path })`, disabled while a promise `run` returned is pending. A store skips it, and its path is not a `PrefPath`. `prefHoldsValue(leaf)` tells the two sorts of leaf apart.

`PrefsForm`, `SelectionPanel`, and labkit's `ControlPanel` draw both. A list is a `ListEditor` with one control per entry, drawn as the item leaf would be on a row of its own, and an entry of an app-defined kind goes to that kind's renderer. In `PrefsForm`, a list whose entries are objects or lists puts its label above the entries, which need the row's whole width. `PrefsForm` now does the same for a field of an `object` leaf, which used to show "no renderer" for an app-defined kind whether or not one was registered. `ListEditor` takes entries of any type through `renderEntry` and `newEntry`, and stops at `minItems` and `maxItems`. `PrefActionButton` is the action's button, exported for surfaces that draw their own rows.

labkit: `f.list(default, item)` builds a typed list (`f.list([0, 1], f.number(0).range(0, 9))`), `.count(min, max)` bounds it, and `f.action(run)` builds a button. `f.list(strings)` is unchanged. An `f.value` whose default is an array of numbers or booleans is now inferred as a list of them; it used to throw.

**Breaking for anyone who registered a custom kind named `list` or `action`:** those names are built-in now, and a `list` leaf needs an `item`. labkit's own `f.list` leaves carry one.
