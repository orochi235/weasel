---
'@weasel-js/modes': patch
'@weasel-js/core': patch
---

A mode's double-click entry is now read. `ModeDefinition.entry.targets` names the routing kinds a `'double-click-target'` trigger takes — `PATH_EDIT` takes `'path'`, `ISOLATION` takes `'group'`, and `TEXT_EDIT` none, since its edit enters it — and `modeTriggers(registry, { enter, canEnter })` in `@weasel-js/core` turns them into an ambient contribution: a double-click on a node of one of those kinds enters the mode on it, unless `canEnter` refuses and the double-click falls through. Additive.
