---
"@weasel-js/core": patch
"@weasel-js/ui": patch
---

A number pref with a display unit now reads a unit typed into it: `0.25turn` or
`30°` in the rotation field stores π/2 or π/6, and `12mm` in a field showing
centimeters stores what 1.2cm is.

**`prefUnit(system, displayUnit, { precision?, suffix? })`** builds a
`ToolPrefNumberUnit` from a `UnitSystem`, so a leaf no longer hand-writes its
conversion. `ToolPrefNumberUnit` gains `accepts`, the units a person may type
and the factor each scales by. `ANGLE_RADIANS` joins the unit tables, and
`rotationDegreesUnit` is built from it.

**`parseNumber(text, units?)`** reads a trailing unit, longest name first, and
a unit beats a magnitude suffix: with meters accepted, `2m` is two meters.

**`UnitField`** is a text field for a number that can carry a unit. Both
`SelectionPanel` and `PrefsForm` edit a unit leaf through it; a leaf with no
unit keeps `NumberField`.
