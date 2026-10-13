---
'@weasel-js/labkit': patch
---

Fixes: the tooltip of a `ControlPanel` row quoted what a number with a unit would read as auto in stored units, so a row showing `90` degrees said `auto 0.785398`. It is quoted through the unit's `format`, as the field shows it and with its suffix: `auto 45°`.
