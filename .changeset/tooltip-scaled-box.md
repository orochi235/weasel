---
'@weasel-js/ui': patch
---

A `Tooltip` inside a box drawn at another size, as a magnifier draws its copy, now opens against its trigger instead of the box's scale times its offset away. It places itself through React Aria's `useOverlayPosition` with the trigger read in the box's px, as `Popover` does, in place of React Aria's `Tooltip`; its props are unchanged.
