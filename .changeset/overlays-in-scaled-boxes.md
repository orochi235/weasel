---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

A popover or context menu opened inside a box drawn at another size, by `transform: scale()` or `zoom`, now opens against its trigger or pointer. Before, it landed that many times its offset from the box's corner, so in a 2× magnifier's copy a Callout opened about 100px below its button. Every ui popover (Callout, Select, ComboBox, PaintField, the Bar's popovers, ActionSettings) and labkit's ControlMatrix editor go through a new `Popover`, which is React Aria's with the trigger measured in the box's own px; use it in place of React Aria's for the same placement. Flipping and the height limit still measure the viewport unscaled, and a Tooltip is still misplaced there.
