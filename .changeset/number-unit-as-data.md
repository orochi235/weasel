---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
'@weasel-js/core': patch
---

Adds API, and breaks one read: a number leaf's `unit` may be data. `PrefLinearUnit` is `{ suffix?, scale, offset?, accepts?, precision? }`, where `stored = display * scale + offset`, the direction a `UnitEntry` runs toward its base, and `{ scale: 1 }` changes nothing. `PrefFunctionUnit` is the `toDisplay`/`fromDisplay` form, kept for a conversion that is not linear, and `PrefNumberUnit` is either. `resolvePrefUnit(unit)` gives `toDisplay`, `fromDisplay`, and `format` for both, and `isPrefLinearUnit` tells them apart.

Breaking: `prefUnit` now returns the data form, so `prefUnit(...).toDisplay` and `rotationDegreesUnit.toDisplay` are gone, and reading `leaf.unit.toDisplay` no longer typechecks. Call `resolvePrefUnit(leaf.unit).toDisplay` instead. `prefDisplayBounds`, `prefFieldProps`, and with them `PrefsForm`, `SelectionPanel`, and labkit's `ControlPanel` already do.

A data unit prints in `printSchema`'s literal in full, where a unit of functions prints as `KEEP_FROM_SOURCE`, and a draft keeps one set on a leaf the source schema does not hold. `PrefSchemaEditor` offers it on a number, and on a list's number entry, as a Unit attribute: suffix, scale, offset, places, and the suffixes it also takes. A unit of functions is still listed there as code.
