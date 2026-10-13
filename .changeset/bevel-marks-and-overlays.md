---
'@weasel-js/ui': patch
---

A theme's bevel hooks reach more controls. `--wzl-bevel-sunken` is the shadow of a checkbox, a radio, and a switch's track, kept under the focus ring while one holds focus. `--wzl-bevel-raised` is the shadow of a switch's thumb, and replaces the drop shadow of a menu or popover, a tooltip, and a `Dialog`. With neither hook set nothing changes, so only `win9xTheme` and `platinumTheme` draw differently. Which bevel each control takes was chosen without seeing either theme.
