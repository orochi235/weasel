---
"@weasel-js/ui": patch
---

`PrefSchemaEditor` makes bars. Its palette has a Bar, a group's "Drawn as" offers `bar`, and an action pref's attributes hold the key of the registered action it fires and its control.

A schema whose root is drawn `as: 'bar'` previews as the toolbar itself, with a switch that runs it down its side, and its prefs are rows of the tree where another group root's would be unplaced.

The editor lists actions to drag from. `PrefSchemaEditor` gains `actions`, a list of `{ key, label, group?, icon?, shortcut? }`; left out, it lists what the `ActionsRegistry` above it can fire from a button. The list sits under the Unplaced tree and follows the structure's filter. An entry dragged into the tree or the live preview lands as an action pref that fires it by key. A pref that fires a key the list does not hold is marked in the tree, and an action pref's Action attribute is a choice among the list.
