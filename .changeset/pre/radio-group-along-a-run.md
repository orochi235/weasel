---
"@weasel-js/ui": patch
---

`RadioGroup` follows an `Along` arc. Inside an `Along` with a curved shape, its label and radios lie along the shape in reading order, each tipped to its spot and kept upright, the label first and not pressable. The description and any error sit at the middle of the arc one row further in, toward the inside of the bend: below the radios on an arc over the top, above them on one under the bottom. The arrow keys still choose in reading order, `orientation` has no effect on an arc, and a row too long for its arc scrolls along it.
