# Typed units

For whoever builds or reviews this in weasel. It answers one question: how a
number pref that shows a unit reads a value typed in another one, so `12mm`
typed into a field showing centimeters stores the right number.

## The problem

A number pref can store one unit and show another through
`ToolPrefNumberUnit` (`toDisplay` / `fromDisplay` / `suffix`). Nothing reads a
typed unit: both `SelectionPanel` and `PrefsForm` edit through React Aria's
`NumberField`, which refuses letters as they are typed. And the tables that
know `1cm` is `10mm` — `UnitSystem`, `IMPERIAL_INCHES`, `METRIC_MM` — are wired
only to grid snapping, so a pref unit has to hand-write its own conversion.

## Design

1. **`@weasel-js/core` `core/units.ts`:** `ANGLE_RADIANS`, a `UnitSystem` with
   base `rad` and units `rad`, `deg` and `turn`.
2. **`@weasel-js/core` `tools/prefs.ts`:** `ToolPrefNumberUnit.accepts?`, a map
   from a suffix a person may type to the factor that turns a number in it
   into a display number. And `prefUnit(system, displayUnit, { precision?,
   suffix? })`, which builds a whole `ToolPrefNumberUnit` from a system: stored
   values are in the system's base, shown in `displayUnit` rounded to
   `precision` places, and every unit in the system is accepted.
   `rotationDegreesUnit` becomes `prefUnit(ANGLE_RADIANS, 'deg', { precision:
   1, suffix: '°' })`.
3. **`@weasel-js/ui` `format/number.ts`:** `parseNumber(text, units?)`. Given
   units, a trailing unit name is read first and scales the number before it;
   the longest name that matches wins, so `mm` beats `m`, and an exact-case
   match beats a case-insensitive one. A unit beats a magnitude suffix: with
   meters accepted, `2m` is two meters, not two million.
4. **`@weasel-js/ui` `UnitField`:** a text field for a number that commits on
   blur or Enter, reverts on Escape or unreadable text, clamps to its bounds,
   and steps with the arrow keys. It exists because React Aria's `NumberField`
   cannot be made to accept letters. It shares `NumberField`'s stylesheet.
5. **Both panels:** a number leaf with a `unit` edits through `UnitField`,
   accepting the unit's `accepts` plus its `suffix` at a factor of 1 — so `90°`
   reads even on a hand-written unit with no table. A leaf without a unit keeps
   `NumberField`.

### Out of scope

- Compound values (`5ft 3in`), and units with an offset (°C/°F): the tables are
  linear factors by design.
- `ControlPanel` in labkit ignores `unit` entirely, and `NumberRow`'s `unit` is
  a display label. Both are recorded in `docs/TODO.md`.

## Tests

- `ANGLE_RADIANS`'s factors; `prefUnit`'s conversion both ways, its rounding,
  its `accepts` table, its suffix alias, and a throw on an unknown display unit.
- `parseNumber` with units: longest match, unit over magnitude, case fallback,
  a space before the unit, an unknown unit as NaN, and `12mm` shown in cm as
  exactly `1.2`.
- `UnitField`: a typed unit commits converted, unreadable text and Escape
  commit nothing, Enter commits once, bounds clamp, arrows step.
- `PrefsForm` and `SelectionPanel`: `0.25turn` and `90°` store π/2.
