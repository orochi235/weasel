---
'@weasel-js/ui': patch
---

With several nodes selected in `PrefSchemaEditor`, every attribute they differ on is drawn and can be overwritten. A condition, a list, a map, a union, and an enum's options used to be listed as `mixed` with no control; each is now drawn holding nothing, and the first edit is written over every selected node. An object attribute is still split, so the fields that agree keep their values.

A row that stands for values that differ draws its label in the warning color: `PropertyRow` takes `mixed`, and `PrefsForm` sets it from its own `mixed` paths. Where a form draws `Mixed` in place of a list's or a map's editor it offers Replace all, which starts every one over from nothing so the editor can be drawn; `PrefMixed` takes `onReplace` for that.
