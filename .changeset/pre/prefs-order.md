---
"@weasel-js/prefs": patch
"@weasel-js/ui": patch
---

`orderPrefGroup` reorders a group's children, and the children of its nested groups, by a stored `PrefOrder` keyed by container path, and `resolveOrder` is the rule it follows for keys the store lacks. An `actions` leaf takes `order`, and the actions it draws follow it, with any it does not name at the end.
