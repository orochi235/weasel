---
'@weasel-js/ui': patch
---

Every property row's control is named after the row's label: `SliderRow`'s slider and readout, and the fields in `NumberRow`, `TextRow`, `SelectRow`, `ColorRow` and `CheckboxRow`. `ToggleRow`'s segments are named after their options, inside a group named after the row. `PropertyRow`'s `<label>` labels only the first input inside it. On a slider row that is the numeric readout, on any row with a `description` it is the ⓘ help button, and on a toggle row it is the first segment. So the range input had no name, a described row's control lost its name, and a toggle's first segment took the row's name.
