---
'@weasel-js/ui': patch
---

`MenuButton` opens its list with the context menu's DOM renderer instead of React Aria's `Menu`, so a menu button, a bar's menu and a right-click menu share one controller: the same highlight, type-to-select and Escape. `MenuButtonItem.label` is now a `string` and `textValue` is gone, since the label is what a row is named and typed against.
