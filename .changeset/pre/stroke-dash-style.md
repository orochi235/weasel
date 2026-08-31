---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

A stroke's dash is edited as a style, not as an array

`Stroke.dash` already rendered, imported and exported; it had no control,
because a `number[]` has no leaf kind. It doesn't need one — the thing a person
chooses is a style, and the array is how it is stored. The stroke block gains a
Solid / Dashed / Dotted / Custom bar under cap, join and align.

`ToolPrefEnum` gains `encoding`: `read`/`write` between the stored value and
the option string, the counterpart of the `unit` a number leaf already has for
a value stored in a canonical unit. Both directions are handed the object the
leaf is a field of, because a dash pattern is meaningless without the width it
scales by — SVG dash lengths are absolute, so a fixed `[6, 3]` is dots on a
hairline and a railroad on a 20px stroke. `dashForStrokeStyle` /
`strokeDashStyleOf` are the mapping, exported: **dashed is 3× the width on and
2× off, dotted 1× on and 2× off**. An array matching neither reads as `custom`,
a new `disabled` option — one a control reports but refuses to author, since
there is no array behind it. `solid` is stored as no dash at all, and an object
leaf's field written as `undefined` is now removed rather than left holding it.
