---
"@weasel-js/labkit": patch
---

`ControlPanel` draws a section's governing control in the section's title row. `.heading()` on a boolean or enum leaf puts its control beside the title of the section, the group, or the panel `title` holding it, and that title becomes the control's accessible name: an on/off switch, or a kind picker. A first row whose label only repeats its heading, such as "Chuck" under "Chuck" or "Pump" under "Pumping", is lifted the same way, with a development warning naming it, since the repeat is an authoring mistake. A repeating row whose control is too big for a title row (a slider, a text field, or a custom renderer) stays a row and still warns.
