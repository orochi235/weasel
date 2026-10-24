---
"@weasel-js/forge": patch
"@weasel-js/ui": patch
---

forge builds a control for far more of a component's props. A prop typed as an array, a tuple, an object or a union of objects gets a control built from its parts: a list edited entry by entry, an object edited field by field, and a union of objects that each pin one field to a string edited as a choice of that string with the chosen object's own fields under it. A union a string may stand in, such as a `ReactNode`, gets a text field, and a union mixing string literals with types no control edits offers the literals. An argType may give a value's shape itself through `type`, Storybook's `SBType`, now exported as `ArgShape`. An object type declared in a dependency, or open to any key, gets no control.

`BandEditor`'s stories pass every arg through, so its panel now edits the display (fraction, decimal or percent, with each one's options), the ticks, the label, the range limits and the selected band, beside the range, scale and snapping it already had.
