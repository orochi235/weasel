---
'@weasel-js/ui': patch
---

Text fields, textareas, focused slider readouts, number inputs and dialog triggers in a `PrefsForm` group panel now draw a visible field. The panel and its subpanels are painted `--wzl-surface-sunken`, which is also every field's default surface, so a field there had the same color as the panel behind it. The panels now set `--wzl-input-surface` the way the rail already did, and those controls read it.
