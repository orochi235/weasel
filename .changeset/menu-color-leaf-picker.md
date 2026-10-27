---
'@weasel-js/menu': patch
'@weasel-js/routing': patch
'@weasel-js/ui': patch
---

A color leaf drawn as a menu is now editable. `MenuColorEntry` gains `set` and `alpha`, and the controller holds a color row's value as it does a text row's (`colorValue`, `setColor`). `resolveSchemaMenu` passes `set` for a color leaf that is not a `readout` when `onChange` is given. In the DOM menu, pressing such a row, or Enter on it, opens the kit's `ColorField` in a popover beside the row; a press inside the popover does not dismiss the menu, and each committed color is written without closing it. A color row without `set` stays read-only. Adds API.
