---
'@weasel-js/ui': patch
---

`SelectionPanel` draws a leaf marked `heading` in its section's title row, as `PrefsForm` and labkit's `ControlPanel` do: named for the section, beside the title rather than inside it, so the title's dimming does not reach the control. It stays a row in a section with no heading (a tab, a bar, a fragment, an unnamed one), where the panel has a renderer of its own for the leaf, and where a pair shares its row.
