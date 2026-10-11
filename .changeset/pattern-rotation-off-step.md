---
'@weasel-js/ui': patch
---

`PatternPicker`'s Rotation field holds any angle. It could only hold multiples of 15°: typing `20` rotated the pattern 15°, and a paint already rotated 22.5° read as `30°`. The 15° step now applies only to the arrow keys and the stepper buttons, and a typed or existing angle is kept as it is, to one decimal place. The field is now a `UnitField`, so its input has the `spinbutton` role.
