---
'@weasel-js/prefs': patch
'@weasel-js/routing': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A group's, a section's, or a leaf's `enableIf` no longer disables a leaf directly inside it that the condition reads. That leaf is the node's switch, and it stays live so the node can be turned back on. So a panel of settings that can be turned on and off, such as one layer effect, is a group whose `enableIf: { path: '<group>.on' }` reads a boolean marked `heading`: the checkbox sits in the panel's title, and turning it off disables everything else in the panel. This holds in `PrefsForm`, `SelectionPanel`, labkit's `ControlPanel`, and schema menus, and `prefScopeIn` exposes the rule to other walkers.

`MotifFrame`, `PropertyGroup`, and `Subpanel` take `disabled`, which dims the title and leaves the controls beside it alone. A settings form passes it for each group its `enableIf` turns off.
