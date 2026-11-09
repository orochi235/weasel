---
"@weasel-js/svg": patch
---

A `transform` whose arguments abut where the next one starts with a sign or a point, as minifiers write them (`translate(10-20)`, `scale(.5.5)`), is now read as browsers read it instead of being ignored whole with a warning.
