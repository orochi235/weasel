---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

`PropertyField` is the one settings row, its control chosen by `kind` (and
`control`): `<PropertyField kind="number" control="slider" label="Blur" …>`.
`CheckboxRow`, `SwitchRow`, `TextRow`, `SelectRow`, `SliderRow`, `NumberRow`,
`ColorRow` and `ToggleRow`, with their `*RowProps` types, are removed, from
`@weasel-js/ui` and from labkit's re-exports. This is a breaking change for
anyone calling them: each is `PropertyField` with a `kind`, and its props carry
over unchanged.

| Removed | Now |
| --- | --- |
| `CheckboxRow` | `kind="boolean"` |
| `SwitchRow` | `kind="boolean" control="switch"` |
| `TextRow` | `kind="string"` |
| `NumberRow` | `kind="number"` |
| `SliderRow` | `kind="number" control="slider"` |
| `SelectRow` | `kind="enum"` |
| `ToggleRow` | `kind="enum" control="toggle"` |
| `ColorRow` | `kind="color"` |

- `PropertyControl` draws the same control with no row around it, for a cell
  that shares a row. `kind` also takes `paint` and `font-family`.
- Every field takes `mixed` (the sources disagree) and `unset` (they agree on
  holding nothing), and shows no value for either.
- `chrome="framed"` draws the kit's field components in place of the row's
  native inputs — `UnitField` for a number with `accepts`, `Checkbox`,
  `Input`, a boxed `Select`, `RadioGroup` and `ToggleBar`, `ColorField`.
  `PropertyRow` takes the same `chrome`, and leaves a framed field's inputs to
  its own stylesheet.
- A text field given `onInput` drafts, reporting each keystroke to `onInput`
  and the settled text to `onChange` on blur or Enter.
- `color`'s `alpha` may be `true`, keeping the alpha in a `#rrggbbaa` value.
- A bare `enum` with `control="radio"` is segments with radio semantics; with
  `control="toggle"` it stays pressable segments.
- `prefFieldProps(leaf, state)` turns a schema leaf into `PropertyControl`
  props: a number in its display unit and its bounds, an enum through its
  encoding, an icon as a glyph. `ControlPanel`, `PrefsForm`, `SelectionPanel`
  and `ToolOptionsBar` all draw their built-in kinds through it.
- `PrefsForm` rows are `PropertyRow`s, so a preference's label and help take
  the params label look the other settings surfaces use. A leaf's slider is a
  track with an editable readout, and a `radio` enum in `SelectionPanel` is a
  radio group rather than a dropdown.
- `InlineRange` forwards its ref to the input.
