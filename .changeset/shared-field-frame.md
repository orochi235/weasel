---
'@weasel-js/ui': patch
---

`Input`, `Select`, `NumberField`, `UnitField`, `ComboBox`, `MenuButton`'s trigger and `ListEditor`'s inputs now draw their box and form-row layout from one shared stylesheet, which `Field` and `fieldClasses` also use, instead of six copies. `ComboBox` gains `orientation="row"`, setting its label beside the field as the others do.

Where the copies had drifted, they now agree: `Select` and `MenuButton` follow a container's `--wzl-field-h` like the other fields (`--wzl-select-h` still wins on a `Select`), `ListEditor`'s inputs animate their focus ring and set `line-height: 1`, and `NumberField` colors its placeholder like the others.
