---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A `list` pref takes `control: 'list' | 'tokens'`. A list of plain text with `control: 'tokens'` is drawn as a `TokenField`, a chip per entry, in `PrefsForm`, `SelectionPanel` and labkit's `ControlPanel`; any other list is drawn as before. `PrefTextList` is the one control all three use for a text list.

`TokenField` takes `minItems`, `maxItems` and `locked(index)`, the limits and per-entry lock `ListEditor` has.

The asset editor offers `Control` on list prefs, and draws its own tag, short-name and field-kind lists as tokens.
