---
'@weasel-js/ui': patch
---

`Select`, `NumberField`, `UnitField`, and `Input` take a `mixed` prop for a control standing for several values that differ: it reads "Mixed" in place of the placeholder, and on `Select`, `NumberField`, and `UnitField` it also clears the selection or value. `FontFamilySelect`, `FontWeightSelect`, and the property and pref controls pass it rather than spelling the word themselves.

The form controls share one set of slot props, exported as the `FieldSlotProps` type. `ComboBox` rows now have the same gap between their contents as `Select` rows.

`Input` accepts a boolean `spellCheck`, as a native `<input>` does.
