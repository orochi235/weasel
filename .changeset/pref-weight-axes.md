---
'@weasel-js/prefs': patch
---

`prefWeightAxes(options)` lays a selector's weights out as numbers, the `axes` an `@weasel-js/animator` target
takes, so an animation can drive `store.get(path, { weights })` or `applyTheme`'s `weights` from one option to
another. Adds API.
