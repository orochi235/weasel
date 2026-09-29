---
'@weasel-js/ui': patch
---

`FillStrokeSwatch`'s `onChange` can return the color it actually applied, and the recent colors record that color instead of the picker's. The native picker has no alpha, so an app that keeps a paint's own opacity was recording an opaque swatch for a see-through paint. Returning nothing keeps the old behavior.
