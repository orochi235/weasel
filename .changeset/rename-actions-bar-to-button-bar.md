---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

Rename `ActionsBar` to `ButtonBar`, along with its `ButtonBarItem`, `ButtonBarProps`, `ButtonBarSize` and `ButtonBarVariant` types. The old name read as a variant of `ActionBar`, which renders actions from the kit's actions registry; this one is a plain strip of callback buttons, the momentary sibling of `ToggleBar` and `OptionsBar`. Breaking: the old names have no alias.
