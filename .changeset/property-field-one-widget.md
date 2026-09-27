---
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

`PropertyField`, `PropertyControl` and `PropertyRow` no longer take `chrome`, and the
`PropertyFieldChrome` type is gone — a breaking change for any caller that passed it.
Each field kind now draws one widget on every surface:

- A typed number is a `UnitField`: it reads a typed unit (`accepts`) everywhere, reports
  each keystroke through a lone `onChange` or through `onInput` beside a settled
  `onChange`, is a spin button (arrows, Page Up/Down, Home/End, the wheel while focused),
  and draws steppers with `steppers`, which now defaults to off. A caller that wants
  settled values only passes a no-op `onInput`.
- Text is an `Input`; a textarea always wears the field frame.
- A choice is a `Select` — borderless with an underlined value when set directly in a
  property row, boxed where a surface wraps it — a `ToggleBar` for `control="toggle"`, and
  a `RadioGroup` for `control="radio"`. labkit's `.radio()` draws segments, as it says, through the toggle.
- A color is a `ColorField`, which gains `id` and `alphaDisabled` and commits when the
  picker closes as well as on blur. An alpha held apart (`alpha={0.5}`) still reports
  through `onAlphaChange` / `onAlphaInput`.
- A checkbox is a native box dressed as the kit's `Checkbox`, so the row's label still
  toggles it.
- A slider's track is the shared range skin with no fill; its readout is the tab stop
  and steps like the track.

`UnitField` gains `onInput`, `steppers` and `id` and is `role="spinbutton"`.
`NumberField` and `Select` fill with `--wzl-input-surface` where a surface sets it. `Select`
gains look hooks (`--wzl-select-bg`, `-pad`, `-chevron`, `-underline`, `-focus-border`,
`-focus-shadow`, `-focus-outline`) that draw the bare look from context.
