---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Adds API: `prefTabRuns(items, isTab)` in `@weasel-js/prefs` walks a group's children in order with each run of neighboring `tab` children folded into one step, the strip they share. `PrefsForm`'s panes, an object leaf's rows, `SelectionPanel`'s sections, and labkit's `ControlPanel` each collected that run in a loop of their own and now walk this one. Nothing draws differently.
