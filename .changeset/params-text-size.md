---
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
"@weasel-js/theme": patch
---

A row's label and its value now share one size on every params surface — `PropertyPanel`,
`Prefs`, `SelectionPanel`, `DetailList` and labkit's `ControlPanel`. It comes from a new hook,
`--wzl-params-text-size`, which defaults to `--wzl-font-size-sm` and so still moves with density
and theme; set it on any ancestor and labels and values follow together. Visible change: text and
number field values, radio and menu choices, and `DetailList` values shrink from the body size to
the label size, and `SelectionPanel`'s labels take the cased label recipe the other surfaces use.

Fields, selects, radios, segmented bars and buttons read a second hook, `--wzl-field-font-size`,
before their own size; a params row sets it. A mark smaller than its value on purpose — a unit, a
stepper glyph, an input adornment, a hint — carries `data-wzl-subordinate`.
