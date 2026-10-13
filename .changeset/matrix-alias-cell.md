---
'@weasel-js/labkit': patch
---

Fixes: a `ControlMatrix` cell over an alias summarized the alias's own path, which holds nothing, so it read as empty whatever the setting held. The cell now draws the leaf the alias points at, in `over` or the matrix's own schema: its value, or its default where the config holds none, as a switch, a swatch, or a summary, and a switch or swatch writes at that leaf's path. The row takes that leaf's name and description where `rows` gives no label.

An alias's cell shows another setting, so it never draws as inherited, Option/Alt-click does not unpin it, and its popover has no Inherit button; Clear, for a color that may be unset, clears the leaf it shows.
