---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A group or a section can be drawn `as: 'menu'`: on a bar, a button opening its contents as a menu; in a menu, a submenu; in a panel, a titled box as `panel` is. `prefAsBox` answers whether a panel boxes a node drawn `as` a given value.

Every leaf holding a value takes `readout: true`, meaning it is drawn showing its value but not editable. The field lives on the new `PrefValueBase`, so an `action`, `alias`, `label`, or `separator` cannot carry it.

A new leaf kind, `actions` (`{ kind: 'actions', group }`), stands for every action the host registered in an action group, in registry order, each drawn as an `action` leaf would be. It holds no value: a store neither reads nor writes it, and it has no `PrefPath`. The schema editor offers both new fields and the new kind.
