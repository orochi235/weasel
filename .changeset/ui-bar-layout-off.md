---
'@weasel-js/ui': minor
---

New `off` on `BarLayout` dims a bar's lead without disabling its cells, so a section an `enableIf` turns off keeps its own switch live.

`disabled` on `BarLayout` now holds every cell. PrefsForm, SelectionPanel, and labkit's ControlPanel pass `off` for a bar section or group their conditions turn off, and its cells say for themselves whether they are disabled.

<!-- entry: api fix -->
