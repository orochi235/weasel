---
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

A lab draws an enum the control it asks for, as a form and a panel already did: `.radio()` is a radio group rather than segments, and `menu` is a menu button rather than a select. A slider with only one bound is a slider on every surface, a lab included: its track runs 100 on from the bound it has, and its readout takes and steps to values past that open end. Where a place has no room for the control asked for, one new table, `PARAMS_ENUM_PLACES` (read through `enumControlAt`), says what it draws instead: a bar draws radios as segments, and a `ControlMatrix` cell's popover lists a select or a menu as radios. `BarField` and labkit's `MatrixEditor` take their enum control from it, and the popover now draws segments for an enum asking for them.
