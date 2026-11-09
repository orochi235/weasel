---
'@weasel-js/routing': patch
'@weasel-js/ui': patch
---

Disabled menu rows say why, and actions inside list entries and objects latch.

- A menu row drawn from a pref that a condition disables carries the pref's `disabledReason`, for boolean, enum, number, color, string and action rows and for every row inside an object, list or map it draws. A field or option with a reason of its own keeps it. Before, these rows were disabled with no reason, and an action row dropped even its action's own.
- A prefs form and a selection panel draw an action pressed where its `activeIf` holds when the action is a field of a list's or a map's entry, or of an object. Before, only an action at the top of the form latched: the entry's `active` set from `applyPrefEntryConditions` was never read.
