---
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

A lab draws an enum with the control it asks for, as a form and a panel do: `.radio()` is a radio group, and `menu` is a menu button.

Where a place has no room for the control asked for, a new table, `PARAMS_ENUM_PLACES` (read through `enumControlAt`), says what it draws instead: a bar draws radios as segments, and a `ControlMatrix` cell's popover lists a select or a menu as radios. `BarField` and labkit's `MatrixEditor` take their enum control from it, and the popover draws segments for an enum asking for them.

<!-- entry: fix api visual -->
